import "dotenv/config";
import express from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import twig from "twig";
import { fileURLToPath } from "url";
import { PrismaClient } from "./generated/prisma/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middlewares
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Twig setup
app.set("views", path.join(__dirname, "views"));
app.engine("twig", twig.__express);
app.set("view engine", "twig");

// Routes
app.get("/", function (req, res) {
  res.render("index", { title: "Chat temps réel" });
});

// API de test des messages
app.get("/api/messages", async function (req, res) {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json(messages);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des messages" });
  }
});

app.post("/api/messages", async function (req, res) {
  try {
    const user = (req.body && req.body.user) || "Anonyme";
    const text = (req.body && req.body.text) || "";
    if (!text.trim()) {
      return res.status(400).json({ error: "Le champ 'text' est requis" });
    }
    const created = await prisma.message.create({
      data: { pseudo: String(user), content: String(text) },
    });
    // Diffuser aux clients connectés
    io.emit("chat:message", { user: created.pseudo, text: created.content });
    res.status(201).json(created);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de l'enregistrement du message" });
  }
});

// Socket.IO
io.on("connection", async function (socket) {
  console.log("Un utilisateur est connecté");

  // Envoyer l'historique (limité aux 50 derniers) au nouveau client
  try {
    const lastMessages = await prisma.message.findMany({
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    for (const m of lastMessages) {
      socket.emit("chat:message", { user: m.pseudo, text: m.content });
    }
  } catch (_) {}

  socket.on("chat:message", async function (msg) {
    // Diffuser à tous les clients
    try {
      // msg attendu: { user, text }
      const user = msg && msg.user ? String(msg.user) : "Anonyme";
      const text = msg && msg.text ? String(msg.text) : "";
      if (text.trim()) {
        await prisma.message.create({ data: { pseudo: user, content: text } });
      }
      io.emit("chat:message", { user, text });
    } catch (_) {
      // En cas d'erreur DB, on émet tout de même le message non persisté
      io.emit("chat:message", msg);
    }
  });

  socket.on("disconnect", function () {
    console.log("Un utilisateur s'est déconnecté");
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, function () {
  console.log("Express + Socket.IO sur http://127.0.0.1:" + PORT + "/");
});

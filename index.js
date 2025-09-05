var express = require("express");
var path = require("path");
var http = require("http");
var { Server } = require("socket.io");
var bodyParser = require("body-parser");
var twig = require("twig");

var app = express();
var server = http.createServer(app);
var io = new Server(server);

// Middlewares
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));

// Twig setup
app.set("views", path.join(__dirname, "views"));
app.engine("twig", twig.__express);
app.set("view engine", "twig");

// Routes
app.get("/", function (req, res) {
  res.render("index", { title: "Chat temps réel" });
});

// Socket.IO
io.on("connection", function (socket) {
  console.log("Un utilisateur est connecté");

  socket.on("chat:message", function (msg) {
    // Diffuser à tous les clients
    io.emit("chat:message", msg);
  });

  socket.on("disconnect", function () {
    console.log("Un utilisateur s'est déconnecté");
  });
});

// Start server
var PORT = process.env.PORT || 5000;
server.listen(PORT, function () {
  console.log("Express + Socket.IO sur http://127.0.0.1:" + PORT + "/");
});

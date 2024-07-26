"use strict";

const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const port = Number(process.env.PORT) || 5000;
const bodyParser = require("body-parser");
const UUID = require("uuid");
//const { timeStamp } = require("console");
//解决跨域请求问题
app.all("*", function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "");
  res.header("Access-Control-Allow-Headers", "X-Requested-With,Content-Type");
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  next();
});

app.use(express.static("public"));
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());
//set static file path
app.use(express.static(__dirname + "/public/config"));
app.use(express.static(__dirname + "/public"));

app.get("/ace.js", function (req, res) {
  res.sendFile(__dirname + "/node_modules/ace-builds/src-noconflict/ace.js");
});

app.get("/theme-monokai.js", function (req, res) {
  res.sendFile(
    __dirname + "/node_modules/ace-builds/src-noconflict/theme-monokai.js"
  );
});

app.get("/socket.js", function (req, res) {
  res.sendFile(__dirname + "/node_modules/socket.io/lib/socket.js");
});

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

app.get("/SText", function (req, res) {
  console.log("mode: ", req.query.mode);
  if (req.query.mode == "redirect") {
    //console.log("asts");
    res.sendFile(__dirname + "/coediting.html");
  } else {
    res.sendStatus(404);
  }
});

app.post("/login", function (req, res) {
  console.log(" sessionId", req.query.sessionId);
  let id = req.query.sessionId;
  if (id == undefined) {
    console.log(" create new sessionid");
    id = createNamespace();
  } else {
    //check session valid
    let valid = checkSessionValid(id);
    if (!valid) {
      return res.sendStatus(404);
    }
  }
  let data = { id: id };
  res.end(JSON.stringify(data)); //普通的json
});

var nsList = []; //namespace list

function checkSessionValid(id) {
  let index = nsList.findIndex((ele) => {
    return ele.id == id;
  });
  if (index == -1) {
    return false;
  } else {
    return true;
  }
}

function createNamespace() {
  let id = UUID.v1(); //create a unique session id;
  let space = io.of("/" + id);

  space.on("connection", callback);

  let session = {
    id: id,
    namespace: space,
    userInfo: [],
    userId: 0,
    ackJoinNum: 0,
    ackLeaveNum: 0,
    gn: 0,
  };
  nsList.push(session);
  return id;
}

function callback(socket) {
  let index = nsList.findIndex((ele) => {
    return ele.namespace.name == socket.id.split("#")[0];
  });
  if (index == -1) console.log(" can't find socket in the namespace !!!");
  let session = nsList[index]; //get this socket's namespace session
  let userInfo = session.userInfo;

  let ns = socket.nsp; //get namespace object to broadcast

  function generateUID(session) {
    return ++session.userId;
  }

  function resetUIDGen(session) {
    session.userId = 0;
  }

  function addUser(socket, userId, userName) {
    userInfo.push({
      sender: socket,
      uid: userId,
      uname: userName,
    });
  }

  function getUserList() {
    // userlist is used for client side for showing membership
    let data = [];
    userInfo.forEach(function (ele) {
      data.push({
        uid: ele.uid,
        socketid: ele.sender.id,
        uname: ele.uname,
      });
    });
    return data;
  }

  function removeUser(socket) {
    let index = userInfo.findIndex(function (element) {
      return (
        element.sender.id === socket.id ||
        element.sender.nsp + "#" + element.sender.id == socket.id
      );
    });
    if (index == -1 || userInfo[index] == undefined) return undefined;
    let name = userInfo[index].uname;
    userInfo.splice(index, 1);
    return name;
  }

  socket.on("bindUser", function (userName) {
    if (userInfo.length == 0) {
      addUser(socket, generateUID(session), userName);
      console.log("a user creates a new collaboration session");

      socket.emit("newSession", {
        sid: userInfo[0].uid,
        snum: 1,
        sname: userName,
      });
    } else {
      addUser(socket, undefined, userName);
      socket.broadcast.emit("prepareJoin", userName);
    }
    ns.emit("updateUL", getUserList());
  });

  socket.on("ackPrepareJoin", function () {
    //所有人都确认了StartJoin,再去提取state
    console.log("ackPrepareJoin");
    session.ackJoinNum = session.ackJoinNum + 1;
    console.log("ackJoinNum");
    if (session.ackJoinNum == userInfo.length - 1) {
      console.log("send prepareState msg!");
      userInfo[0].sender.emit("prepareState");
      session.ackJoinNum = 0;
    }
  });

  socket.on("ackPrepareState", function (state) {
    console.log("ackPrepareState");
    resetUIDGen(session);
    userInfo.forEach(function (element) {
      let id = generateUID(session); //
      if (element.uid != undefined) {
        // alrady in the session;
        element.uid = id;
        element.sender.emit("newSession", {
          sid: id,
          snum: userInfo.length,
        });
      } else {
        element.uid = id;
        element.sender.emit("laterCommer", {
          sid: id,
          snum: userInfo.length,
          state: state,
        });
      }
    });
  });

  socket.on("editOps", function (message) {
    message.timestamp.gn = ++session.gn;
    socket.broadcast.emit("editOps", message);
    socket.emit("timestamp", message.timestamp); //send to the sender;
  });

  socket.on("stateMsg", function (message) {
    socket.broadcast.emit("stateMsg", message);
  });

  socket.on("disconnect", function () {
    let name = removeUser(socket);
    if (name == undefined) return;
    if (userInfo.length === 0) {
      resetUIDGen(session);
      nsList.splice(index, 1); //delete session
      console.log("delete session! ", session.id);
    } else {
      socket.broadcast.emit("prepareLeave", name);
      socket.broadcast.emit("updateUL", getUserList());
      console.log("disconnect  id: ", socket.id);
    }
  });

  socket.on("ackPrepareLeave", function () {
    console.log("ackPrepareLeave");
    session.ackLeaveNum = session.ackLeaveNum + 1;
    if (session.ackLeaveNum == userInfo.length) {
      resetUIDGen(session);
      userInfo.forEach(function (element) {
        let id = generateUID(session);
        element.id = id;
        element.sender.emit("newSession", {
          sid: id,
          snum: userInfo.length,
        });
      });
      session.ackLeaveNum = 0;
    }
  });
}

server.listen(port, function () {
  console.log("listening on *:" + port);
});

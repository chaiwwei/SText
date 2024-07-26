function runCollabAce(ulistUpdate, editor, comm, cma) {
  remoteUpdate = false;
  isChangedThisPeriod = false;
  isChangedLastPeriod = false;

  stateTimer = setInterval(function () {
    if (isChangedThisPeriod == false) {
      if (isChangedLastPeriod == true) {
        comm.emit("stateMsg", cma.getState());
      }
      isChangedLastPeriod = false;
    } else {
      isChangedThisPeriod = false;
      isChangedLastPeriod = true;
    }
  }, 10000);

  editor.session.doc.on("change", function onContentChanged(delta) {
    isChangedThisPeriod = true;
    if (remoteUpdate == true) {
      return;
    }
    //console.log("delta: ", delta);
    let start = editor.session.doc.positionToIndex(delta.start);
    let content = "";
    let lineNum = delta.lines.length;
    for (let i = 0; i < lineNum - 1; i++) {
      content = content + delta.lines[i] + "\r\n";
    }
    content = content + delta.lines[lineNum - 1];

    let op = undefined;
    if (delta.action == "remove") {
      op = {
        type: "del",
        pos: start,
        str: content,
      };
    }

    if (delta.action == "insert") {
      op = {
        type: "ins",
        pos: start,
        str: content,
      };
    }
    comm.emit("editOps", cma.localHandle(op));
  });

  comm.on("editOps", function (msg) {
    remoteUpdate = true;
    let lop = cma.remoteHandle(msg);
    lop.forEach(function (op) {
      if (op.type == "del") {
        let count = (op.str.match("/\r\ng") || []).length;
        let start = editor.session.doc.indexToPosition(op.pos);
        let end = editor.session.doc.indexToPosition(
          op.pos + op.str.length - count
        );
        editor.session.doc.remove({
          //每次Remove 都会出发contentChanged事件
          start,
          end,
        });
      } else {
        let start = editor.session.doc.indexToPosition(op.pos);
        editor.session.doc.insert(start, op.str);
      }
    });
    cma.gc(); // every time a remote is handled, gc is invoked;
    remoteUpdate = false;
  });

  comm.on("newSession", function (data) {
    // console.log('newSession:');
    // console.log(data);
    remoteUpdate = false;
    editor.setReadOnly(false);
    cma.ini(data.sid, data.snum, editor.session.doc.getValue());
  });

  comm.on("prepareJoin", function (userName) {
    editor.setReadOnly(true);
    comm.emit("ackPrepareJoin");
    GrowlNotification.notify({
      //notify new user join the session
      title: "New Partner Joined",
      description: "<br>" + userName + "</br>" + " have joined your session~",
      type: "success",
      position: "top-right",
      closeTimeout: 5000,
    });
  });

  comm.on("prepareState", function () {
    console.log("send ackPrepareState msg!");
    comm.emit("ackPrepareState", editor.session.doc.getValue());
  });

  comm.on("prepareLeave", function (userName) {
    editor.setReadOnly(true);
    comm.emit("ackPrepareLeave");
    GrowlNotification.notify({
      //notify new user join the session
      title: "One Partner Left",
      description: "<br>" + userName + "</br>" + " have left your session~",
      type: "warning",
      position: "top-right",
      closeTimeout: 5000,
    });
  });

  comm.on("laterCommer", function (data) {
    //console.log("laterCommer:")
    //console.log(data);
    remoteUpdate = true; //prevent call onContentChanged event
    editor.session.doc.setValue(data.state);
    remoteUpdate = false;
    editor.setReadOnly(false);
    cma.ini(data.sid, data.snum, data.state);
  });

  comm.on("stateMsg", function (msg) {
    cma.updateState(msg);
    cma.gc();
  });

  comm.on("timestamp", function (msg) {
    cma.timestamping(msg);
  });

  comm.on("updateUL", function (userList) {
    ulistUpdate(userList, comm.id);
  });
}

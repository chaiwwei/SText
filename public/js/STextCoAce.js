"use strict";

const radius = 24;
const leftMargin = 30;
const circleMargin = 80;
const topMargin = 30;
const pathLength = 62;
const numPerLine = 5;
const svgTopMargin = 50;
const svgHeight = 400;

const updateTableInterval = 8000;
var autoEditTimer = null;
var autoEditEnabled = false;

let namespace = window.localStorage.getItem("sessionId");
if (namespace == undefined) {
  console.log(" false don't have namespace!");
}

const socket = io("/" + namespace);
const editor = ace.edit("editor");
const userName = localStorage.getItem("user"); //login page have save user name in localStorage~
//editor.session.doc.setNewLineMode('windows'); //newline character '/r/n'
//editor.focus();

settings(editor);

const cmstext = new CMSText();
runCollabAce(ulistUpdate, editor, socket, cmstext);
bindUser();
//cursorTrack(socket, editor); //uncomment this to turn on cursorTrack

$("#showBtn").click(function () {
  //var fre = setInterval(freshDebugWindow,500)
  freshDebugWindow();
  //reset the window position
  var el = document.getElementById("chart");
  el.style.top = "0px";
  el.style.left = "0px";

  $("#chart").show();
});

$("#enableAutoEdit").click(function () {
  if (autoEditEnabled == false) {
    autoEditEnabled = true;
    var count = 0;
    var freq = 500;
    var ratio = 6;
    var doc = editor.session.doc;
    const inStr = "var x = 0;\r\nvar y = -1;";

    autoEditTimer = setInterval(function () {
      var lineNum = doc.getLength();
      var selRow = 0;
      var selCol = 0;
      if (lineNum > 1) {
        selRow = Math.floor(Math.random() * lineNum);
      }

      var colNum = doc.getLine(selRow).length;
      if (colNum > 1) {
        selCol = Math.floor(Math.random() * colNum);
      }
      remoteUpdate = false;
      if (count < ratio) {
        doc.insert(
          {
            row: selRow,
            column: selCol,
          },
          inStr
        );
      } else if (count < 10) {
        if (colNum == 0) {
          doc.removeInLine(selRow, 0, colNum);
        } else {
          doc.removeFullLines(selRow, selRow);
        }
      }
      count++;
      if (count == 10) {
        count = 0;
      }
    }, freq);
  } else {
    autoEditEnabled = false;
    if (autoEditTimer !== null) {
      clearInterval(autoEditTimer);
    }
  }
});

//copy str to clipboard
function copyToClipboard(str) {
  let el = document.createElement("textarea");
  el.value = str;
  el.setAttribute("readonly", "");
  el.style.position = "absolute";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

$("#shareBtn").click(function () {
  let sessionId = socket.nsp.slice(1);
  let presentUrl = window.location.href;
  let domain = presentUrl.split("SText")[0];
  let sharedLink = domain + "?sessionId=" + sessionId;
  //let sharedLink = domain + "?sessionId=" + sessionId;
  //console.log("sharedLink : ", sharedLink);
  copyToClipboard(sharedLink);
  GrowlNotification.notify({
    //notify new user join the session
    description:
      "links have been copied on clipboard,you can shared it to others to join your session!",
  });
});

$("#closeBtn").click(function () {
  $("#chart").hide();
});

function freshDebugWindow() {
  //auto fresh the debug window every 0.5s
  var data = generateData(cmstext.getObjs());
  updateSVG(data.nodes, data.links);
}

function generateData(objs) {
  let nodes = [];
  let links = [];

  for (let i = 0; i < objs.length; i++) {
    let k = i + 1; //because of Head node, so k=i+1;
    let row = Math.floor(k / numPerLine);
    let column = k % numPerLine;
    nodes.push({
      x: leftMargin + (radius * 2 + pathLength) * column + radius,
      y: topMargin + (radius * 2 + circleMargin) * row + radius,
      str: objs[i].str,
      vis: objs[i].vis,
      no: k,
    });
    if (i > 0) {
      links.push({
        source: nodes[i - 1],
        target: nodes[i],
        left: false,
        right: true,
      });
    }
  }
  return {
    nodes: nodes,
    links: links,
  };
}

function updateSVG(nodes, links) {
  // path (link) group
  let rowNum = Math.floor((nodes.length + 1) / numPerLine) + 1;
  let neededSvgHeight = rowNum * (circleMargin + radius * 2) + topMargin;
  if (neededSvgHeight > svgHeight) {
    $("svg").height(neededSvgHeight);
  } else {
    $("svg").height(svgHeight);
  }

  let paths = d3.select("#paths").selectAll("path").data(links);
  //paths.remove();
  paths.exit().remove();

  paths
    .enter()
    .append("svg:path")
    .attr("d", (d) => {
      let sourceX = d.source.x + radius;
      let sourceY = d.source.y;
      let targetX = d.target.x - radius;
      let targetY = d.target.y;

      return `M${sourceX},${sourceY}L${targetX},${targetY}`;
    })
    .attr("class", "link")
    .style("marker-start", (d) => (d.left ? "url(#start-arrow)" : ""))
    .style("marker-end", (d) => (d.right ? "url(#end-arrow)" : ""));

  let circles = d3.select("#circles").selectAll("g").data(nodes);
  //circles.remove();

  circles.exit().remove();
  const g = circles
    .enter()
    .append("svg:g")
    .merge(circles)
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  g.append("svg:circle")
    .attr("r", radius)
    .style("fill", function (d) {
      if (d.vis) {
        return "red";
      } else {
        return "blue";
      }
    })
    .on("mouseover", function (event, d) {
      //console.log("mouseover");
      document.getElementById("feedback").innerHTML = d.str;
      document.getElementById("no").setAttribute("value", d.no);
      document.getElementById("vis").setAttribute("value", d.vis);
    });

  g.append("svg:text")
    .attr("dominant-baseline", "middle")
    .attr("text-anchor", "middle")
    .text((d) => d.no)
    .on("mouseover", function (event, d) {
      //console.log("mouseover");
      //d3.select('#footer span').html(d.str);
      document.getElementById("feedback").innerHTML = d.str;
      document.getElementById("no").setAttribute("value", d.no);
      document.getElementById("vis").setAttribute("value", d.vis);
    });

  if (nodes.length == 0) {
    document
      .getElementById("lastRect")
      .setAttribute("transform", `translate(190,42)`);
    document.getElementById("lastPath").setAttribute("d", `M66,54L190,54`);
  } else {
    let k = nodes.length + 1;
    let row = Math.floor(k / numPerLine);
    let column = k % numPerLine;

    let x = leftMargin + column * (pathLength + radius * 2) + radius / 2;
    let y = topMargin + row * (circleMargin + radius * 2) + radius / 2;

    let sourceX = nodes[nodes.length - 1].x + radius;
    let sourceY = nodes[nodes.length - 1].y;
    let targetX = x;
    let targetY = y + radius / 2;

    document
      .getElementById("lastRect")
      .setAttribute("transform", `translate(${x},${y})`);
    document
      .getElementById("lastPath")
      .setAttribute("d", `M${sourceX},${sourceY}L${targetX},${targetY}`);
  }
}

//递归计算一个元素的绝对偏移～
function getAbsoluteTop(el) {
  return el.offsetParent
    ? el.offsetTop + getAbsoluteTop(el.offsetParent)
    : el.offsetTop;
}

function getAbsoluteLeft(el) {
  return el.offsetParent
    ? el.offsetLeft + getAbsoluteLeft(el.offsetParent)
    : el.offsetLeft;
}

function dragElement() {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  var elmnt = document.getElementById("chart");
  document.getElementById("header").onmousedown = dragMouseDown;
  document.getElementById("footer").onmousedown = dragMouseDown;
  document.getElementById("content").onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();

    //limit the elelment's position in the window
    //获取浏览器可视窗口的大小
    var w =
      window.innerWidth ||
      document.documentElement.clientWidth ||
      document.body.clientWidth;
    var h =
      window.innerHeight ||
      document.documentElement.clientHeight ||
      document.body.clientHeight;

    // calculate the new cursor position:
    //保存原来的老位置
    var oldTop = elmnt.style.top;
    var oldLeft = elmnt.style.left;

    // set the element's new position:
    //尝试改变成新位置
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = elmnt.offsetTop - pos2 + "px";
    elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
    //位置改变后获取绝对偏移量用作判断是否移动到可视窗口外
    var aLeft = getAbsoluteLeft(elmnt);
    var aTop = getAbsoluteTop(elmnt);
    var header = document.getElementById("header"); //保证header一直在可视窗口内
    if (
      aLeft >= 0 &&
      aLeft <= w - header.offsetWidth &&
      aTop >= 0 &&
      aTop <= h - header.offsetHeight
    ) {
      //新位置满足要求，header没有移动到可视窗口外，移动完毕
    } else {
      //如果移动后的结果不满足绝对位置的条件，那么就重新回到原来的老位置
      elmnt.style.top = oldTop;
      elmnt.style.left = oldLeft;
    }
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function ulistUpdate(ulist, socketid) {
  //刷新用户列表(清空再添加)
  //console.log(ulist);
  let list = $("div.sidebar-submenu.clientlist ul");
  list.empty();
  ulist.forEach(function (ele) {
    //jQuery在客户端列表中添加元素
    if (
      ele.socketid === socketid ||
      ele.socketid === socket.nsp + "#" + socketid
    ) {
      console.log("draw myself in ulist");
      list.prepend(
        "<li><a href='#'><i class='fa fa-user-circle'></i>" +
          ele.uname +
          "</a></li>"
      );
    } else {
      console.log("draw partner in ulist");
      list.append(
        "<li><a href='#'><i class='fa fa-user'></i>" + ele.uname + "</a></li>"
      );
    }
  });
}

function bindUser() {
  if (userName === undefined) {
    return;
  }
  socket.emit("bindUser", userName);
  localStorage.removeItem("user"); //remove userName in localStorage for another user to login
}

dragElement();
/**
 *
 * tool function to judge client socket.id and server socket.id equal because namespace
 * will be added to server socket.id
 * @param cid  client id don't contain namespace
 * @param sid  server id have namespace
 */
function isSameId(cid, sid) {
  return socket.nsp + "#" + cid == sid || cid == sid;
}
// client-side
socket.on("connect", () => {
  console.log(" client connect success!"); //待检查namespace销毁后客户端还能不能成功连接,服务端要nslist中移除会话
  console.log(" client socket.id", socket.id); // 打印客户端id
  console.log(" clinet nsp", socket.nsp);
});

//about dynamic sidebar
$(".sidebar-dropdown > a").click(function () {
  $(".sidebar-submenu").slideUp(250);
  if ($(this).parent().hasClass("active")) {
    $(".sidebar-dropdown").removeClass("active");
    $(this).parent().removeClass("active");
  } else {
    $(".sidebar-dropdown").removeClass("active");
    $(this).next(".sidebar-submenu").slideDown(250);
    $(this).parent().addClass("active");
  }
});
$("#toggle-sidebar").click(function () {
  $(".page-wrapper").toggleClass("toggled");
});

if (
  !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
) {
  $(".sidebar-content").mCustomScrollbar({
    axis: "y",
    autoHideScrollbar: true,
    scrollInertia: 300,
  });
  $(".sidebar-content").addClass("desktop");
}

// GrowlNotification.notify({
//     title: 'Well Done!',
//     description: 'You just submit your resume successfully.',
//     type: 'success',
//     position: 'top-right',
//     closeTimeout: 0
// });

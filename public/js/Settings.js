/**
 * This file support UI settings of ace editor
 *
 *
 *
 *
 */

function settings(editor) {
  //---------default settings---------//
  editor.setOptions({
    selectionStyle: "text",
    highlightActiveLine: false,
    highlightSelectedWord: true,
    readOnly: "true",
    newLineMode: "windows",
    fontSize: 10,
    showLineNumbers: false,
    theme: "ace/theme/monokai",
    mode: "ace/mode/c_cpp",
  });
  //----------------------------------//

  $("#ShowLineNumbers").click(function () {
    if ($(this).prop("checked")) {
      editor.setOption("showLineNumbers", true);
    } else {
      editor.setOption("showLineNumbers", false);
    }
  });

  $("#FullLineSelection").click(function () {
    if ($(this).prop("checked")) {
      editor.setOption("selectionStyle", "line");
    } else {
      editor.setOption("selectionStyle", "text");
    }
  });

  editor.setHighlightActiveLine(false);
  //设置光标行高亮
  $("#HighlightActiveLine").click(function () {
    if ($(this).prop("checked")) {
      editor.setHighlightActiveLine(true);
    } else {
      editor.setHighlightActiveLine(false);
    }
  });

  //设置字体大小
  $("#setFontSize").bind("input propertychange", function () {
    let size = $(this).val() + "px";
    document.getElementById("editor").style.fontSize = size;
  });

  //设置模式
  $("#setMode").on("change", function () {
    let checkText = $(this).find("option:selected").text();
    if (checkText === "c++") {
      checkText = "c_cpp";
    } else if (checkText === "c#") {
      checkText = "csharp";
    }
    editor.session.setMode("ace/mode/" + checkText);
  });

  //设置主题
  $("#setTheme").on("change", function () {
    let checkText = $(this).find("option:selected").text();
    editor.setTheme("ace/theme/" + checkText);
  });

  $("#chart").hide();
}

function setTheme(theme) {
  editor.setTheme("ace/theme/" + theme);
}

function setMode(mode) {
  editor.session.setMode("ace/mode/" + mode);
}

function toggleShowLineNumber() {
  let flag = editor.getOption("showLineNumbers");
  if (!flag) {
    editor.setOption("showLineNumbers", true);
    $("#_sln").removeClass("fa-times");
    $("#_sln").addClass("fa-check-square-o");
  } else {
    editor.setOption("showLineNumbers", false);
    $("#_sln").removeClass("fa-check-square-o");
    $("#_sln").addClass("fa-times");
  }
}

function toggleFullLineSelect() {
  let style = editor.getOption("selectionStyle");
  if (style != "line") {
    editor.setOption("selectionStyle", "line");
    $("#_fls").removeClass("fa-times");
    $("#_fls").addClass("fa-check-square-o");
  } else {
    editor.setOption("selectionStyle", "text");
    $("#_fls").removeClass("fa-check-square-o");
    $("#_fls").addClass("fa-times");
  }
}

function toggleHighLightActive() {
  let active = editor.getHighlightActiveLine();
  if (!active) {
    editor.setHighlightActiveLine(true);
    $("#_hal").removeClass("fa-times");
    $("#_hal").addClass("fa-check-square-o");
  } else {
    editor.setHighlightActiveLine(false);
    $("#_hal").removeClass("fa-check-square-o");
    $("#_hal").addClass("fa-times");
  }
}

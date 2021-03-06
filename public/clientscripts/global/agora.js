/* global $, document, window, moment, datepicker_lang, datepicker_format, fc_lang */
"use strict";

var surroundWithLink = function (text) {
  // shamelessly stolen from http://stackoverflow.com/questions/1500260/detect-urls-in-text-with-javascript
  var urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(urlRegex, function (url) {
    return "<a href=\"" + url + "\" target=\"_blank\">" + "<i class=\"fa fa-external-link\"/> " + url + "</a>";
  });
};

var surroundTwitterName = function (twittername) {
  if (twittername.trim().length === 0) {
    return twittername;
  }
  return "<a href=\"http://twitter.com/" + twittername + "\" target=\"_blank\">@" + twittername + "</a>";
};

var surroundEmail = function (email) {
  return "<a href=\"mailto:" + email + "\">" + email + "</a>";
};

var displayedActivityStart = null;
var displayedActivityEnd = null;

var initCalendar = function () {
  // page is now ready, initialize the calendar...
  $('#calendar').each(function () {
    $(this).fullCalendar({
      lang: fc_lang,
      aspectRatio: 1.2,
      weekMode: 'variable',
      timeFormat: '',
      titleFormat: {
        month: 'MMM \'YY'
      },
      buttonText: {
        prev: '<i class="fa fa-caret-left"></i>',
        next: '<i class="fa fa-caret-right"></i>'
      },
      buttonIcons: {
        prev: null,
        next: null
      },
      timezone: 'Europe/Berlin',
      events: '/activities/eventsForSidebar',
      eventMouseover: function (event) {
        var day = event.start.day();
        $(this).tooltip({
          title: event.start.format('HH:mm') + ": " + event.title,
          trigger: "manual",
          placement: (day < 4 && day > 0) ? "right" : "left"
        });
        $(this).tooltip('show');
      },
      eventMouseout: function () {
        $(this).tooltip('destroy');
      },

      eventAfterAllRender: function () {
        if (displayedActivityStart) {
          this.select(displayedActivityStart, displayedActivityEnd, true);
        }
      }
    });
  });
};

var resizePreScrollable = function () {
  var h = $(window).height();
  var padtop = parseInt($('body').css('padding-top'), 10);
  var padbottom = parseInt($('body').css('padding-bottom'), 10);
  var otherElementsHeight = 95;
  $('.pre-scrollable').css('maxHeight', Math.max(h - (padtop + padbottom + otherElementsHeight), 250) + 'px');
};

var initPickers = function () {
  $('.datepicker').datepicker({
    autoclose: true,
    format: datepicker_format,
    weekStart: 1,
    viewMode: 'days',
    minViewMode: 'days',
    language: datepicker_lang
  });

  $('.timepicker').timepicker({
    template: false,
    minuteStep: 15,
    showSeconds: false,
    showMeridian: false
  });

};

var highlightCurrentSection = function () {
  var loc = window.location.href; // returns the full URL
  $('li').filter(function () {
    return this.id && new RegExp(this.id).test(loc);
  }).first().addClass('active');
};

var addHelpButtonToTextarea = function () {
  $('textarea').each(function () {
    $(this).markdown({
        additionalButtons: [
          [
            {
              name: "groupCustom",
              data: [
                {
                  name: "cmdHelp",
                  title: "Help",
                  icon: "fa fa-question-circle",
                  callback: function () { $("#cheatsheet").modal({remote: "/cheatsheet.html"}); }
                }
              ]
            }
          ]
        ],
        onPreview: function (e) {
          $.post("/preview",
            {data: e.getContent(), subdir: ($("#subdir").val() || $("#assignedGroup").val() || $('#id').val()), _csrf: $("#_csrf").val()},
            function (data) { $(".md-preview").html(data); }
          );
          return ""; // to clearly indicate the loading...
        },
        iconlibrary: 'fa'
      }
    );
  });
};

var extendDataTables = function () {
  if (!$.fn.dataTableExt) { return; }
  $.extend($.fn.dataTableExt.oSort, {
    "date-eu-pre": function (dateString) { return moment(dateString, 'DD.MM.YYYY HH:mm').unix(); },
    "date-eu-asc": function (a, b) { return a - b; },
    "date-eu-desc": function (a, b) { return b - a; }
  });
};

$.event.add(window, "resize", resizePreScrollable);
$(document).ready(highlightCurrentSection);
$(document).ready(addHelpButtonToTextarea);
$(document).ready(initPickers);
$(document).ready(resizePreScrollable);
$(document).ready(initCalendar);
$(document).ready(extendDataTables);
$(document).ready(function () {
  $('.urlify').each(function () {
    $(this).html(surroundWithLink(this.innerHTML));
  });

  $('.twitterify').each(function () {
    $(this).html(surroundTwitterName(this.innerHTML));
  });

  $('.mailtoify').each(function () {
    $(this).html(surroundEmail(this.innerHTML));
  });
  $("[rel=tooltip]").each(function () {
    $(this).popover({html: true, trigger: "hover"});
  });
  $("[rel=tooltip-in-body]").each(function () {
    $(this).popover({container: "body", html: true, trigger: "hover"});
  });
});

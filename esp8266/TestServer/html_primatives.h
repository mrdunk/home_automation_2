#ifndef ESP8266__HTML_PRIMATIVES__H
#define ESP8266__HTML_PRIMATIVES__H

#include <ESP8266WiFi.h>


const char javascript[] PROGMEM = R"=====(
function save(label) {
  console.log('save', label);
  var target = label.split('_')[0];
  if(target === 'device'){
    var device = label.split('_')[1];
    var topic = document.getElementsByClassName(label + '_topic')[0].value;
    var topics = topic.split('/');
    var iotype = document.getElementsByClassName(label + '_iotype')[0].value;
    var iopins = document.getElementsByClassName(label + '_iopins')[0].value;
    var url = 'http://' + window.location.host + '/set/?device=' + device;
    url += '&iotype=' + iotype;
    url += '&iopins=' + iopins;
    for(var i = 0; i < topics.length; i++){
      url += '&address_segment=' + encodeURIComponent(topics[i]);
    }
    send(url);
  } else if(target === 'hostname' || target === 'publishprefix' ||
            target === 'subscribeprefix' || target === 'firmwareserver'){
    var data = document.getElementsByClassName(target)[0].value;
    console.log(target);
    var url = 'http://' + window.location.host + '/set/?' + target + '=';
    url += encodeURIComponent(data);
    send(url);
  } else {
    console.log(label, target);
  }
};
function send(url) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
       if (xmlHttp.readyState == 4 && xmlHttp.status == 200){
         console.log('Successful GET');
         location.reload();
       }
    }
    xmlHttp.open("GET", url);
    xmlHttp.send();
};
function del(label) {
  console.log('delete', label);
  var target = label.split('_')[0];
  if(target === 'device'){
    document.getElementsByClassName(label + '_topic')[0].value = '';
    save(label);
  }
};
)=====";

const char style[] PROGMEM = R"=====(
  dl {border: 3px double #ccc;}
  dt {float: left; width: 15em; font-weight: bold; background: darkgrey}
  dt:after {content: ':'; }
  dd {margin-bottom: 1px; margin-left: 0; background: darkgrey;}
  table {border-spacing: 1px; border: 1px solid grey;}
  tr {background: darkgrey; padding: 3px;}
  th {border: 1px solid grey;}
  td {border: 1px solid grey;}
  input, [type=text] {width: 20em;}
  input, [type=number] {width: 3em;}
  .highlight {background: lightgreen;}
  .div-shrink{display: inline;}
)=====";

const String page(const char* style, const char* script,
                  const String& head, const String& body);

const String descriptionList(const String& items);

const String descriptionListItem(const String& key, const String& value);

const String textField(const String& name, const String& placeholder,
                       const String& value, const String& class_);

const String table(const String& rows);

const String row(const String& cells, const String& class_name);

const String header(const String& content);

const String cell(const String& content);

const String option(const String& type, const String& selected);

const String outletType(const String& type, const String& class_name);

const String ioPin(const String& value, const String& class_name);

const String div(const String& content, const String& class_name);

const String submit(const String& label, const String& name, const String& action);

const String link(const String& label, const String& url);
#endif  // ESP8266__HTML_PRIMATIVES__H

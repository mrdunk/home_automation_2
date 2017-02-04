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
    var io_pin = document.getElementsByClassName(label + '_io_pin')[0].value;
    var io_default = document.getElementsByClassName(label + '_io_default')[0].value;
    var inverted = document.getElementsByClassName(label + '_inverted')[0].checked;
    var url = 'http://' + window.location.host + '/set/?device=' + device;
    url += '&iotype=' + iotype;
    url += '&io_pin=' + io_pin;
    url += '&io_default=' + io_default;
    url += '&inverted=' + inverted;
    for(var i = 0; i < topics.length; i++){
      url += '&address_segment=' + encodeURIComponent(topics[i]);
    }
    send(url);
  } else if(target === 'hostname' || target === 'publishprefix' ||
            target === 'subscribeprefix' || target === 'firmwareserver' ||
            target === 'enablepassphrase' || target === 'enableiopin' ||
            target === 'ip' || target === 'subnet' || target === 'gateway' ||
            target === 'brokerip'){
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

const char style[] PROGMEM =
  "dl{border: 3px double #ccc; width: 100%;}\n"
  "dl dt, dl dd {float: left; margin:1px 0 0 0; background: darkgrey;}\n"
  "dl dt{clear: left; font-weight: bold; width:15em;}\n"
  "dl dd{overflow: hidden; width: calc(100% - 15em);}\n"

  "table {border-spacing: 1px; border: 1px solid grey;}\n"
  "tr {background: darkgrey; padding: 3px;}\n"
  "th {border: 1px solid grey;}\n"
  "td {border: 1px solid grey;}\n"
  "input, [type=text] {width: 20em;}\n"
  "input, [type=number] {width: 3em;}\n"
  ".highlight {background: lightgreen;}\n"
  ".div-shrink{display: inline;}\n"
  
  "input:required:invalid, input:focus:invalid {background: red;}\n"
  ;

const String pageHeader(const char* style, const char* script);
const String pageFooter();

const String listStart();
const String listEnd();

const String tableStart();
const String tableEnd();

const String rowStart(const String& class_name);
const String rowEnd();

const String descriptionListItem(const String& key, const String& value);

const String textField(const String& name, const String& placeholder,
                       const String& value, const String& class_);

const String ipField(const String& name, const String& placeholder,
                     const String& value, const String& class_);

const String header(const String& content);

const String cell(const String& content);

const String option(const String& type, const String& selected);

const String outletType(const String& type, const String& class_name);

const String ioPin(const int value, const String& class_name);

const String ioValue(const int value, const String& class_name);

const String ioInverted(const bool value, const String& class_name);

const String div(const String& content, const String& class_name);

const String submit(const String& label, const String& name, const String& action);

const String link(const String& label, const String& url);
#endif  // ESP8266__HTML_PRIMATIVES__H

#include "html_primatives.h"

void wrapInPage(const char* style, const char* script, String& body)
{
  body = "<!DOCTYPE html>\n<html><meta http-equiv=\"Cache-Control\" "
         "content=\"no-cache, no-store, must-revalidate\" />"
         "<head><style>" + String(style) + "</style>\n<script src=\"" + 
         String(script) + "\"></script></head>\n<body>" + body;
  body.concat("</body>\n</html>");
}

const String pageHeader(const char* style, const char* script){
  return "<!DOCTYPE html>\n<html><meta http-equiv=\"Cache-Control\" "
         "content=\"no-cache, no-store, must-revalidate\" />"
         "<head><style>" + String(style) + "</style>\n<script src=\"" + 
         String(script) + "\"></script></head>\n<body>";
}

const String pageFooter(){
  return "</body>\n</html>";
}

void wrapInList(String& items){
  items = "<dl>" + items;
  items.concat("</dl>");
}

const String listStart(){
  return "<dl>";
}

const String listEnd(){
  return "</dl>";
}

const String descriptionListItem(const String& key, const String& value){
  return "<dt>" + key + "</dt><dd>" + value + "</dd>";
}


const String textField(const String& name, const String& placeholder,
                       const String& value, const String& class_)
{
  String return_value = "<input type=\"text\" name=\"";
  return_value += String(name);
  return_value += "\" class=\"";
  return_value += class_;
  return_value += "\" value=\"";
  return_value += String(value);
  return_value += "\" placeholder=\"";
  return_value += String(placeholder);
  return_value += "\">";
  return return_value;
}

const String ipField(const String& name, const String& placeholder,
                       const String& value, const String& class_)
{
  String return_value = "<input type=\"text\" "
                        "pattern=\"\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\" name=\"";
  return_value += String(name);
  return_value += "\" class=\"";
  return_value += class_;
  return_value += "\" value=\"";
  return_value += String(value);
  return_value += "\" placeholder=\"";
  return_value += String(placeholder);
  return_value += "\">";
  return return_value;
}

void wrapInTable(String& rows){
  rows = "<table>" + rows;
  rows.concat("</table>");
}

const String tableStart(){
  return "<table>";
}

const String tableEnd(){
  return "</table>";
}

const String row(const String& cells, const String& class_name){
  return "<tr class=\"" + class_name + "\">" + cells + "</tr>";
}

const String rowStart(const String& class_name){
  return "<tr class=\"" + class_name + "\">";
}

const String rowEnd(){
  return "</tr>";
}

const String header(const String& content){
  return "<th>" + content + "</th>";
}

const String cell(const String& content){
  return "<td>" + content + "</td>";
}

const String option(const String& type, const String& selected){
  if(type == selected){
    return "<option value=\"" + type + "\" selected>" + type + "</option>";
  }
  return "<option value=\"" + type + "\">" + type + "</option>";
}

const String outletType(const String& type, const String& class_name){
  String return_value = "<select class=\"" + class_name + "\">";
  return_value += option("test", type);
  return_value += option("onoff", type);
  return_value += option("pwm", type);
  return_value += option("input", type);
  return_value += "</select>";
  return return_value;
}

const String ioPin(const int value, const String& class_name){
  // http://www.esp8266.com/wiki/doku.php?id=esp8266_gpio_pin_allocations
  String return_value = "<select class=\"";
  return_value += class_name;
  return_value += "\">";
  for(int pin = 0; pin <= 5; pin++){
    return_value += "<option value=\"";
    return_value += String(pin);
    return_value += "\"";
    if(pin == value){
      return_value += " selected";
    }
    return_value += ">";
    return_value += String(pin);
    return_value += "</option>";
  }
  for(int pin = 12; pin <= 16; pin++){
    return_value += "<option value=\"";
    return_value += String(pin);
    return_value += "\"";
    if(pin == value){
      return_value += " selected";
    }
    return_value += ">";
    return_value += String(pin);
    return_value += "</option>";
  }
  return_value += "</select>";
  return return_value;
}

const String ioValue(const int value, const String& class_name){
  String return_value = "<input type=\"number\" max=\"255\" min=\"0\" class=\"";
  return_value += class_name;
  return_value += "\" value=\"";
  return_value += String(value);
  return_value += "\"></input>";
  return return_value;
}

const String ioInverted(const bool value, const String& class_name){
  String return_value = "<input type=\"checkbox\" class=\"";
  return_value += class_name;
  return_value += "\" ";
  if(value){
    return_value += "checked";
  }
  return_value += "></input>";
  return return_value;
}

const String div(const String& content, const String& class_name){
  return "<div class=\""+ class_name + "\">" + content + "</div>";
}

const String submit(const String& label, const String& name, const String& action){
  String return_value = "<button type=\"button\" name=\"";
  return_value += name;
  return_value += "\" onclick=\"";
  return_value += action;
  return_value += "\">";
  return_value += label;
  return_value += "</button>";
  return return_value;
}

const String link(const String& label, const String& url){
  String return_value = "<a href=\"";
  return_value += url;
  return_value += "\">";
  return_value += label;
  return_value += "</a>";
  return return_value;
}

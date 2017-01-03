#ifndef ESP8266__HTML_PRIMATIVES__H
#define ESP8266__HTML_PRIMATIVES__H

#include <ESP8266WiFi.h>


const String javascript();

const String page(const String& style, const String& script,
                  const String& head, const String& body);

const String descriptionList(const String& items);

const String descriptionListItem(const String& key, const String& value);

const String style();

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

#endif  // ESP8266__HTML_PRIMATIVES__H

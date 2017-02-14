#ifndef ESP8266__HTML_PRIMATIVES__H
#define ESP8266__HTML_PRIMATIVES__H

#include <ESP8266WiFi.h>


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

const String portValue(const int value, const String& class_name);

const String ioValue(const int value, const String& class_name);

const String ioInverted(const bool value, const String& class_name);

const String div(const String& content, const String& class_name);

const String submit(const String& label, const String& name, const String& action);

const String link(const String& label, const String& url);
#endif  // ESP8266__HTML_PRIMATIVES__H

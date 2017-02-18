/* Copyright 2017 Duncan Law (mrdunk@gmail.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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

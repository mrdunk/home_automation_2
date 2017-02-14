/* Copyright <YEAR> <COPYRIGHT HOLDER>
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

#ifndef ESP8266__HOST_ATTRIBUTES_H
#define ESP8266__HOST_ATTRIBUTES_H

#include "config.h"
#include "devices.h"

struct Config {
  char hostname[HOSTNAME_LEN];
  IPAddress ip;
  IPAddress gateway;
  IPAddress subnet;
  IPAddress broker_ip;
  int broker_port;
  char subscribe_prefix[PREFIX_LEN];
  char publish_prefix[PREFIX_LEN];
  Connected_device devices[MAX_DEVICES];
  char firmware_host[STRING_LEN];
  char firmware_directory[STRING_LEN];
  int firmware_port;
  char enable_passphrase[STRING_LEN];
  int enable_io_pin;
  bool pull_firmware;
  char wifi_ssid[STRING_LEN];
  char wifi_passwd[STRING_LEN];
  char config_version[4];

  bool save();
  bool load(const String& filename="/config.cfg", bool test=false);
}; 


// Ensure buffer contains only valid hostname characters.
void sanitizeHostname(char* buffer);

void SetHostname(const char* new_hostname);

// The URL to an HTTP server where firmware can be pulled from.
void SetFirmwareServer(const char* new_fws, char* dest_buffer);

//bool pullFile(const String& filename);
bool enterSubSet(String& input, int& level);
bool getKeyValue(String& input, String& key, String& value);

#endif  // ESP8266__HOST_ATTRIBUTES_H

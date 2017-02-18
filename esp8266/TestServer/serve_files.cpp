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

#include <ESP8266WiFi.h>
#include "FS.h"

#include "host_attributes.h"
#include "serve_files.h"

extern WiFiClient wifiClient;

// Perform an HTTP GET request to a remote page
bool getPage(const String& filename, File& file, const Config& config) {
  Serial.println("Get file from firmware_host."); 

  if(wifiClient.connect(config.firmware_host, config.firmware_port)){
    // Make an HTTP GET request
    wifiClient.println(String("GET ") + config.firmware_directory + filename + " HTTP/1.1");
    wifiClient.print("Host: ");
    wifiClient.println(config.firmware_host);
    wifiClient.println("Connection: close");
    wifiClient.println();
  } else {
    return false;
  }

  bool header_received = false;
  int status_code = 0;
  String content_type = "";

  // If there are incoming bytes, print them
	while (wifiClient.connected()){
		if (wifiClient.available())
		{
			String line = wifiClient.readStringUntil('\n');

      if(!header_received){
        line.trim();
        if(line.startsWith("HTTP/") and line.endsWith("OK")){
          line = line.substring(line.indexOf(" "));
          line.trim();
          status_code = line.substring(0, line.indexOf(" ")).toInt();
        }
        if(line.startsWith("Content-type:")){
          content_type = line.substring(line.indexOf(" "));
          content_type.trim();
        }
        if(line == ""){
          if(status_code == HTTP_OK and content_type != ""){
            header_received = true;
            Serial.print("Status code: ");
            Serial.println(status_code);
            Serial.print("Content type: ");
            Serial.println(content_type);
            Serial.println();
          } else {
            Serial.println("Malformed header.");
            return false;
          }
        }
      } else {
        // Content.
	      file.println(line);
      }
    }
  }
  wifiClient.stop();

  return true;
}


bool pullFile(const String& filename, const Config& config){
	bool result = SPIFFS.begin();
  if(!result){
		Serial.println("Unable to use SPIFFS.");
    return false;
  }

	// this opens the file in read-mode
	File file = SPIFFS.open("/" + filename, "r");

	if (!file) {
		Serial.print("File doesn't exist yet. Creating it: ");
	} else {
		Serial.print("Overwriting file: ");
	}
  Serial.println(filename);
  file.close();

	// open the file in write mode
	file = SPIFFS.open("/" + filename, "w");
	if (!file) {
		Serial.println("file creation failed");
		return false;
	}

  // Get file from server.
  for(int tries = 0; tries < UPLOAD_FIRMWARE_RETRIES; tries++){
    if (getPage(filename, file, config)){
      break;
    }
    Serial.print("GET \"");
    Serial.print(filename);
    Serial.println("\" failed.");
    return false;
  }

	file.close();
  Serial.println("Done saving config file.");
}



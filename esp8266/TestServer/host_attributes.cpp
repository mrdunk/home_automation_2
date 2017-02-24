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

extern Config config;


// Ensure buffer contains only valid hostname characters.
void sanitizeHostname(char* buffer){
  for(int i=0; i< strlen(buffer);i++){
    if(buffer[i] >= 'A' && buffer[i] <= 'Z'){
      buffer[i] = buffer[i] + 'a' - 'A';
    } else if(buffer[i] >= 'a' && buffer[i] <= 'z'){
      // pass
    } else if(buffer[i] >= '0' && buffer[i] <= '9'){
      // pass
    } else if(buffer[i] == '-'){
      // pass
    } else {
      buffer[i] = '-';
    }
  }
}

void SetHostname(const char* new_hostname) {
  strncpy(config.hostname, new_hostname, HOSTNAME_LEN -1);
  config.hostname[HOSTNAME_LEN -1] = '\0';
  sanitizeHostname(config.hostname);
  WiFi.hostname(config.hostname);
}


// The URL to an HTTP server where firmware can be pulled from.
void SetFirmwareServer(const char* new_fws, char* dest_buffer) {
  strncpy(dest_buffer, new_fws, STRING_LEN -1);
  dest_buffer[STRING_LEN -1] = '\0';
}


void Config::clear(){
  hostname[0] = '\0';
  ip = IPAddress(0,0,0,0);
  gateway = IPAddress(0,0,0,0);
  subnet = IPAddress(255,255,255,0);
  broker_ip = IPAddress(0,0,0,0);
  broker_port = 1883;
  subscribe_prefix[0] = '\0';
  publish_prefix[0] = '\0';
  for(int i = 0; i < MAX_DEVICES; i++){
    devices[i] = (const Connected_device){0};
  }
  firmware_host[0] = '\0';
  firmware_directory[0] = '\0';
  firmware_port = 0;
  enable_passphrase[0] = '\0';
  enable_io_pin = 0;
  wifi_ssid[0] = '\0';
  wifi_passwd[0] = '\0';
}



bool Config::testValue(const String& parent,
                       const String& key,
                       const String& value)
{
  if(parent == "root"){
    if(key == "hostname" ||
       key == "ip" ||
       key == "gateway" ||
       key == "subnet" ||
       key == "broker_ip" ||
       key == "broker_port" ||
       key == "subscribe_prefix" ||
       key == "publish_prefix" ||
       key == "firmware_host" ||
       key == "firmware_directory" ||
       key == "firmware_port" ||
       key == "enable_passphrase" ||
       key == "enable_io_pin" ||
       key == "wifi_ssid" ||
       key == "wifi_passwd" ||
       key == "brokers")
    {
      return true;
    }
  } else if(parent == "brokers"){
    if(key == "address" ||
        key == "io_type" ||
        key == "io_pin" ||
        key == "io_default" ||
        key == "inverted")
    {
      return true;
    }
  }
  return false;
}

bool Config::setValue(const String& parent,
                      const String& key,
                      const String& value,
                      Connected_device& device)
{
  if(parent == "root"){
    if(key == "hostname"){
      SetHostname(value.c_str());
      return true;
    } else if(key == "ip"){
      ip = string_to_ip(value);
      return true;
    } else if(key == "gateway"){
      gateway = string_to_ip(value);
      return true;
    } else if(key == "subnet"){
      subnet = string_to_ip(value);
      return true;
    } else if(key == "broker_ip"){
      broker_ip = string_to_ip(value);
      return true;
    } else if(key == "broker_port"){
      broker_port = value.toInt();
      return true;
    } else if(key == "subscribe_prefix"){
      SetPrefix(value.c_str(), subscribe_prefix);
      return true;
    } else if(key == "publish_prefix"){
      SetPrefix(value.c_str(), publish_prefix);
      return true;
    } else if(key == "firmware_host"){
      SetFirmwareServer(value.c_str(), firmware_host);
      return true;
    } else if(key == "firmware_directory"){
      SetFirmwareServer(value.c_str(), firmware_directory);
      return true;
    } else if(key == "firmware_port"){
      firmware_port = value.toInt();
      return true;
    } else if(key == "enable_passphrase"){
      value.toCharArray(enable_passphrase, STRING_LEN);
      return true;
    } else if(key == "enable_io_pin"){
      enable_io_pin = value.toInt();
      return true;
    } else if(key == "wifi_ssid"){
      // TODO
      return true;
    } else if(key == "wifi_passwd"){
      // TODO
      return true;
    } else if(key == "brokers"){
      return true;
    }
  } else if(parent == "brokers"){
    if(key == "address"){
      int index = 0;
      int previous_index = 0;
      String section = "";
      int segment_counter = 0;
      while(index > -1){
        index = value.indexOf("/", index +1);
        section = value.substring(previous_index, index);

        section.toCharArray(
            device.address_segment[segment_counter].segment, NAME_LEN);
        sanitizeTopicSection(device.address_segment[segment_counter].segment);

        previous_index = index +1;
        segment_counter++;
      }
      return true;
    } else if(key == "io_type"){
      device.setType(value);
      return true;
    } else if(key == "io_pin"){
      device.io_pin = value.toInt();
      return true;
    } else if(key == "io_default"){
      device.io_default = value.toInt();
      return true;
    } else if(key == "inverted"){
      device.setInverted(value);
      return true;
    }
  }
  return false;
}

bool Config::load(const String& filename, bool test){
  if(!test){
    clear();
  }

  bool result = SPIFFS.begin();
  if(!result){
    Serial.println("Unable to use SPIFFS.");
    return false;
  }

  // this opens the file in read-mode
  File file = SPIFFS.open(filename, "r");

  if (!file) {
    Serial.println("File doesn't exist.");
    return false;
  }

  bool error = false;
  int line_num = 0;
  String line = "";
  int level = 0;
  int list_index = 0;
  int previous_list_index = 0;
  bool inside_list = false;
  String parent = "root";
  String key = "";
  String value = "";
  Connected_device device = (const Connected_device){0};

  while(file.available() || line != "") {
    // Remove any preceding "," which are left from previous iterations.
    line.trim();

    //Lets read line by line from the file
    if(line == "" || line == ":"){
      line_num++;
      line += file.readStringUntil('\n');
    }

    if(line.startsWith("#")){
      // Rest of line is a comment so ignore it.
      line = "";
    } else if(getKeyValue(line, key, value)){
      key.toLowerCase();
      //Serial.printf("%i:%s  %s : %s\n", level, parent.c_str(), key.c_str(), value.c_str());
      if((test and !testValue(parent, key, value)) || !setValue(parent, key, value, device)){
        error = true;
        Serial.printf("Problem in file: %s  on line: %i\n", filename.c_str(), line_num);
        Serial.printf("  near: \"%s\"\n", line.c_str());
      }
      if(key == "brokers"){
        parent = key;
        key = "";
      }
      key = "";
    } else if((key != "") && (value != "error")) {
      // Pass.
    } else if(enterSubSet(line, level)){
      if(level == 1 and !inside_list){
        parent = "root";
      }
    } else if(enterList(line, inside_list, list_index, level)) {
      if(!test && list_index != previous_list_index){
        insertDevice(device);
        device = (const Connected_device){0};
        previous_list_index = list_index;
      }
          
      if(level == 1 and !inside_list){
        parent = "root";
        list_index = 0;
        previous_list_index = 0;
      }
    } else if(line.startsWith(",")) {
      // pass
    } else if((key == "") && (line == "")) {
      //blank line
    } else {
      Serial.printf("Problem in file: %s  on line: %i\n", filename.c_str(), line_num);
      Serial.printf("  near: \"%s\"\n", line.c_str());
      return false;
    }
  }

  file.close();
  return !error;
}

bool Config::save(const String& filename){
	bool result = SPIFFS.begin();
  if(!result){
		Serial.println("Unable to use SPIFFS.");
    return false;
  }

	// this opens the file in read-mode
	File file = SPIFFS.open(filename, "r");

	if (!file) {
		Serial.print("File doesn't exist yet. Creating it: ");
	} else {
		Serial.print("Overwriting file: ");
	}
  Serial.println(filename);
  file.close();

	// open the file in write mode
	file = SPIFFS.open(filename, "w");
	if (!file) {
		Serial.println("file creation failed");
		return false;
	}

	file.println("{");

  file.print("  \"hostname\": \"");
  file.print(hostname);
  file.println("\",");

	file.print("  \"ip\": \"");
  file.print(ip_to_string(ip));
  file.println("\",");

	file.print("  \"gateway\": \"");
  file.print(ip_to_string(gateway));
  file.println("\",");

	file.print("  \"subnet\": \"");
  file.print(ip_to_string(subnet));
  file.println("\",");

	file.print("  \"broker_ip\": \"");
  file.print(ip_to_string(broker_ip));
  file.println("\",");

	file.print("  \"broker_port\": \"");
  file.print(broker_port);
  file.println("\",");

	file.print("  \"subscribe_prefix\": \"");
  file.print(subscribe_prefix);
  file.println("\",");

	file.print("  \"publish_prefix\": \"");
  file.print(publish_prefix);
  file.println("\",");

	file.print("  \"firmware_host\": \"");
  file.print(firmware_host);
  file.println("\",");

	file.print("  \"firmware_directory\": \"");
  file.print(firmware_directory);
  file.println("\",");

	file.print("  \"firmware_port\": \"");
  file.print(firmware_port);
  file.println("\",");

	file.print("  \"enable_passphrase\": \"");
  file.print(enable_passphrase);
  file.println("\",");

	file.print("  \"enable_io_pin\": \"");
  file.print(enable_io_pin);
  file.println("\",");

	file.print("  \"wifi_ssid\": \"");
  file.print(wifi_ssid);
  file.println("\",");

	file.print("  \"wifi_passwd\": \"");
  file.print(wifi_passwd);
  file.println("\",");

  file.println("  \"brokers\": [");
  for(int i = 0; i < MAX_DEVICES; i++){
    if(strlen(config.devices[i].address_segment[0].segment) > 0){
      file.print("    {\"address\": \"");
      file.print(DeviceAddress(config.devices[i]));
      file.println("\",");

      file.print("     \"io_type\": \"");
      file.print(TypeToString(config.devices[i].io_type));
      file.println("\",");

      file.print("     \"io_pin\": \"");
      file.print(config.devices[i].io_pin);
      file.println("\",");

      //file.print("     \"io_value\": \"");
      //file.print(config.devices[i].io_value);
      //file.println("\",");

      file.print("     \"io_default\": \"");
      file.print(config.devices[i].io_default);
      file.println("\",");

      file.print("     \"inverted\": \"");
      file.print(config.devices[i].inverted);
      file.println("\"},");
    }
  }
  file.println("  ]");
  file.println("}");

  file.close();
  Serial.println("Done saving config file.");

  return true;
}

void Config::insertDevice(Connected_device device){
  if(device.address_segment[0].segment[0] == '\0'){
    // Not a populated device.
    return;
  }
  for(int i = 0; i < MAX_DEVICES; i++){
    if(devices[i].address_segment[0].segment[0] == '\0'){
      memcpy(&(devices[i]), &device, sizeof(device));
      return;
    }
  }
}


bool enterSubSet(String& input, int& level){
  input.trim();
  if(input.startsWith("{")){
    level++;
    input.remove(0, 1);
    input.trim();
    return true;
  }
  if(input.startsWith("}")){
    level--;
    input.remove(0, 1);
    input.trim();
    return true;
  }
  return false;
}

// Note: Recursive lists do not work. No lists inside lists.
bool enterList(String& input, bool& inside_list, int& list_index,
               int& current_level){
  static int list_level;
  input.trim();
  if(!inside_list and input.startsWith("[")){
    list_level = current_level;
    list_index = 0;
    inside_list = true;
    input.remove(0, 1);
    input.trim();
    return true;
  } else if(inside_list and input.startsWith("]")){
    inside_list = false;
    input.remove(0, 1);
    input.trim();
    
    if(input.startsWith(",")){
      input.remove(0, 1);
    }
    return true;
  } else if(inside_list and input.startsWith(",") and current_level == list_level){
    list_index++;
    input.remove(0, 1);
    input.trim();
    return true;
  }
  return false;
}

bool getKeyValue(String& input, String& key, String& value){
  value = "";
  if(key == ""){
    input.trim();
    if(!input.startsWith("\"") || input.indexOf("\"", 1) < 0){
      return false;
    }
    key = input.substring(1, input.indexOf("\"", 1));
    key.trim();
    input = input.substring(input.indexOf("\"", 1) +1);
  }

  input.trim();
  if(!input.startsWith(":")){
    if(input.length() > 0){
      value = "error";
    }
    return false;
  }
  input = input.substring(1);
  input.trim();

  if(input.length() == 0){
    input = ":";
    return false;
  } else if(input.startsWith("[")){
    // value is a collection. We deal with those in the upper loop.
    return true;
  } else if(input.startsWith("{")){
    // value is a collection. We deal with those in the upper loop.
    return true;
  } else if(input.startsWith("\"")){
    if(input.indexOf("\"", 1) < 0){
      value = "error";
      return false;
    }
    value = input.substring(1, input.indexOf("\"", 1));
    input = input.substring(input.indexOf("\"", 1) +1);

    input.trim();
    if(input.startsWith(",")){
      input.remove(0, 1);
    }
    return true;
  } else {
    // Presumably a number.
    while(input.length()){  
      if(input.c_str()[0] < '0' || input.c_str()[0] > '9'){
        break;
      }
      value += input.c_str()[0];
      input.remove(0, 1);
    }


    input.trim();
    if(input.startsWith(",")){
      input.remove(0, 1);
    }
    return true;
  }
  return false;
}


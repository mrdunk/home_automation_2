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

#include "config.h"
#include "devices.h"
#include "host_attributes.h"


extern void configInterrupt();
extern Config config;

void Connected_device::setType(const String& type){
  if (type == "pwm") {
    io_type = Io_Type::pwm;
  } else if (type == "onoff") {
    io_type = Io_Type::onoff;
  } else if (type == "input") {
    io_type = Io_Type::input;
  } else if (type == "inputPullUp") {
    io_type = Io_Type::input_pullup;
  } else if (type == "timer") {
    io_type = Io_Type::timer;
  } else {
    io_type = Io_Type::test;
  }
}

void Connected_device::setInverted(const String& value){
  if(value == "true"){
    inverted = true;
  } else if(value == "false"){
    inverted = false;
  } else {
    inverted = value.toInt();
  }
}

// Ensure buffer contains only valid characters for a word in an MQTT topic.
void sanitizeTopicSection(char* buffer){
  bool wildcard_found = false;
  for(int i=0; i < strlen(buffer);i++){
    if(wildcard_found){
      // Wildcard was found as first character but there is other stuff here too
      // so mask out the wildcard.
      buffer[0] = '_';
    }

    if(buffer[i] >= 'A' && buffer[i] <= 'Z'){
      // pass
    } else if(buffer[i] >= 'a' && buffer[i] <= 'z'){
      // pass
    } else if(buffer[i] >= '0' && buffer[i] <= '9'){
      // pass
    } else if((buffer[i] == '+' || buffer[i] == '#') && (i == 0)){
      // Wildcards only valid if they are the only character present.
      wildcard_found = true;
    } else {
      buffer[i] = '_';
    }
  }
}

// Ensure buffer contains only valid format for an MQTT topic.
void sanitizeTopic(char* buffer){
  bool wildcard_found = false;
  
  // Remove any trailing "/".
  if(buffer[strlen(buffer) -1] == '/'){
    buffer[strlen(buffer) -1] = '\0';
  }

  for(int i=0; i < strlen(buffer); i++){
    if(buffer[i] == '/' && i > 0 && i < strlen(buffer) -1){
      // Section seperator is fine as long as it's not the first or last character
    } else if(buffer[i] >= 'A' && buffer[i] <= 'Z'){
      // pass
    } else if(buffer[i] >= 'a' && buffer[i] <= 'z'){
      // pass
    } else if(buffer[i] >= '0' && buffer[i] <= '9'){
      // pass
    } else if((buffer[i] == '+' || buffer[i] == '#') && 
              (buffer[i +1] == '/' || buffer[i +1] == '\0') &&
              (i == 0 || buffer[i -1] == '/')){
      // Wildcards only valid if they are the only character in a section.
    } else {
      buffer[i] = '_';
    }
  }
}

// Return MQTT address of a device.
String DeviceAddress(const Connected_device& device) {
  String return_value = "";
  for(int i = 0; i < ADDRESS_SEGMENTS; i++){
    if(strlen(device.address_segment[i].segment) > 0){
      if(i > 0){
        return_value += "/";
      }
      return_value += device.address_segment[i].segment;
    } else {
      break;
    }
  }
  return return_value;
}

// The part of the MQTT topic that is common to all messages on this device.
void SetPrefix(const char* new_prefix, char* dest_buffer) {
  strncpy(dest_buffer, new_prefix, PREFIX_LEN -1);
  dest_buffer[PREFIX_LEN -1] = '\0';
  sanitizeTopic(dest_buffer);
}

// A device is a combination of IO pin, IO type (input, output, etc) and Topic.
void SetDevice(const unsigned int index, struct Connected_device& device) {
  if (index < MAX_DEVICES) {
    memcpy(&(config.devices[index]), &device, sizeof(device));
  }
}


void Io::setup(){
  for(int i=0; i < MAX_DEVICES; i++){
    if (strlen(config.devices[i].address_segment[0].segment) > 0) {
      if(config.devices[i].io_type == input_pullup){
        config.devices[i].io_value = 1;
        pinMode(config.devices[i].io_pin, INPUT_PULLUP);
        if(callback){
          attachInterrupt(digitalPinToInterrupt(config.devices[i].io_pin),
                          callback, CHANGE);
        }
      } else if(config.devices[i].io_type == input){
        config.devices[i].io_value = 1;
        pinMode(config.devices[i].io_pin, INPUT);
        if(callback){
          attachInterrupt(digitalPinToInterrupt(config.devices[i].io_pin),
                          callback, CHANGE);
        }
      } else {
        if (config.devices[i].io_default > 255 || config.devices[i].io_default < 0) {
          config.devices[i].io_default = 0;
        }
        config.devices[i].io_value = config.devices[i].io_default;
        setState(config.devices[i]);
      }
    }
  }
  dirty_inputs = true;
  loop();
}

void Io::loop(){
  const unsigned int now = millis() / 1000;

  if(dirty_inputs){
    dirty_inputs = false;
    for(int i=0; i < MAX_DEVICES; i++){
      if (strlen(config.devices[i].address_segment[0].segment) > 0) {
        if(config.devices[i].io_type == input || config.devices[i].io_type == input_pullup){
          byte value = digitalRead(config.devices[i].io_pin);
          value = (config.devices[i].inverted ? value == 0 : value);
          if(value != config.devices[i].io_value){
            config.devices[i].io_value = value;
            mqttAnnounce(config.devices[i]);

            // This pin is also the enable pin for the configuration menu.
            if(i == config.enable_io_pin){
              configInterrupt();
            }
          }
        }
      }
    }
  }
  if(last_update != now){
    last_update = now;
    for(int i=0; i < MAX_DEVICES; i++){
      if(config.devices[i].io_type == timer){
        setState(config.devices[i]);
      }
    }
  }
}

void Io::changeState(Connected_device& device, String command){
  command.toLowerCase();
  device.io_value = command.toInt();
  if(command == "on" || command == "true"){
    device.io_value = 255;
  } else if(command == "off" || command == "false"){
    device.io_value = 0;
  } else if (device.io_value > 255 || device.io_value < 0) {
    device.io_value = 0;
  }
  setState(device);
}

void Io::setState(Connected_device& device){
  if(device.io_type == onoff){
    pinMode(device.io_pin, OUTPUT);
    // If pin was previously set to Io_Type::pwm we need to switch off analogue output
    // before using digital output.
    analogWrite(device.io_pin, 0);
    
    digitalWrite(device.io_pin, device.inverted ? (device.io_value == 0) : device.io_value);
  } else if(device.io_type == pwm){
    pinMode(device.io_pin, OUTPUT);
    analogWrite(device.io_pin, device.inverted ? (255 - device.io_value) : device.io_value);
  } else if(device.io_type == test){
    Serial.print("Switching pin: ");
    Serial.print(device.io_pin);
    Serial.print(" to value: ");
    Serial.println(device.inverted ? (255 - device.io_value) : device.io_value);
  } else if(device.io_type == input){
  } else if(device.io_type == input_pullup){
  } else if(device.io_type == timer){
    const unsigned int now = millis() / 1000;
    pinMode(device.io_pin, OUTPUT);
    // If pin was previously set to Io_Type::pwm we need to switch off analogue output
    // before using digital output.
    analogWrite(device.io_pin, 0);

    device.io_value = ((now % device.io_default) != 0);

    digitalWrite(device.io_pin, device.inverted ? (device.io_value == 0) : 
                                                  device.io_value);
    if(((now % device.io_default) != 0) && ((now % device.io_default) != 1)){
      // Avoid excessive MQTT announcements.
      return;
    }
  }

	mqttAnnounce(device);
}

void Io::inputCallback(){
  dirty_inputs = true;
}

void Io::mqttAnnounce(const Connected_device& device){
  String payload = "_state:";
  payload += String(device.io_value);
  
  String topic = config.publish_prefix;
  topic += "/";
  topic += DeviceAddress(device);

  mqtt->announce(topic, payload);
}

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

#ifndef ESP8266__DEVICES_H
#define ESP8266__DEVICES_H

#include <Arduino.h>  // String
#include "mqtt.h"


enum Io_Type {
  test,
  pwm,
  onoff,
  input
};

struct Connected_device {
  Address_Segment address_segment[ADDRESS_SEGMENTS];
  Io_Type iotype;
  int io_pin;
  int io_value;
  int io_default;
  bool inverted;
};


// Ensure buffer contains only valid characters for a word in an MQTT topic.
void sanitizeTopicSection(char* buffer);

// Ensure buffer contains only valid format for an MQTT topic.
void sanitizeTopic(char* buffer);

// Return MQTT address of a device.
String DeviceAddress(const Connected_device& device);

// The part of the MQTT topic that is common to all messages on this device.
void SetPrefix(const char* new_prefix, char* dest_buffer);

// A device is a combination of IO pin, IO type (input, output, etc) and Topic.
void SetDevice(const unsigned int index, Connected_device& device);


class Io{
 public:
  Io(Mqtt* mqtt_) : mqtt(mqtt_){};
  void setup();
  void loop();
  void changeState(Connected_device& device, String command);
  void setState(const Connected_device& device);
  void registerCallback(void(*callback_)()){ callback = callback_; }
  void inputCallback();
  void mqttAnnounce(const Connected_device& device);
 private:
  void (*callback)();
  bool dirty_inputs;
  Mqtt* mqtt;
};

#endif  // ESP8266__DEVICES_H

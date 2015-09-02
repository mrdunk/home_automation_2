

var Page = {}

Page.init = function() {
  Page.running_ = true;
  Page.fps_ = 10;
  Page.log_ = document.getElementById("log").getElementsByClassName("draw-elements")[0];
  Page.topics = {};
  Page.topics.solicit_all = 'homeautomation/devices/lighting/all/all/solicit';

  document.getElementById("log").getElementsByClassName("draw-name")[0].innerHTML = "Log";
}

Page.run = function() {
}

Page.exit = function() {
  clearInterval(Page._intervalId_);
}

Page.AppendToLog = function(new_content, color) {
  var li = document.createElement("li");
  li.appendChild(document.createTextNode(new_content));
  Page.log_.appendChild(li)
  if(color){
    li.style.color = color;
  }
}


var Mqtt = {}
Mqtt.reconnectTimeout = 2000;

Mqtt.MQTTconnect = function() {
  Mqtt.broker = new Messaging.Client( host, port, "web_" + parseInt(Math.random() * 100, 10));
  var options = {
      timeout: 3,
      useSSL: useTLS,
      cleanSession: cleansession,
      onSuccess: Mqtt.onConnect,
      onFailure: function (message) {
                 console.log("Connection failed: " + message.errorMessage + "Retrying");
                 setTimeout(Mqtt.MQTTconnect, Mqtt.reconnectTimeout);
      }
  };

  Mqtt.broker.onConnectionLost = Mqtt.onConnectionLost;
  Mqtt.broker.onMessageArrived = Mqtt.onMessageArrived;

  if (username != null) {
    options.userName = username;
    options.password = password;
  }
  console.log("Host="+ host + ", port=" + port + " TLS = " + useTLS + " username=" + username + " password=" + password);
  Mqtt.broker.connect(options);
}

Mqtt.onConnect = function() {
  console.log('Connected to ' + host + ':' + port);
  Mqtt.broker.subscribe(topic, {qos: 0});
  console.log('Subscribed to topic: ' + topic);

  Page.AppendToLog(Page.topics.solicit_all, 'RED');
  Mqtt.send('solicit all', Page.topics.solicit_all);
}

Mqtt.onConnectionLost = function(response) {
  setTimeout(Mqtt.MQTTconnect, Mqtt.reconnectTimeout);
  console.log("connection lost: " + response.errorMessage + ". Reconnecting");
};

Mqtt.onMessageArrived = function(message) {
  var topic = message.destinationName;
  var payload = message.payloadString;

  Page.AppendToLog(topic + ' = ' + payload)

  var room = payload.split("/")[0]
  var device = payload.split("/")[1]
  var value = payload.split("/")[2]


  var rooms = document.body.getElementsByClassName("__rooms");
  var found_room = false;
  var found_device = false;
  var content_element = document.getElementById("content");
  for (var i=0, room_element; room_element = rooms[i]; i++) {
    if (xtag.hasClass(room_element, room)){
      found_room = room;
      
      room_element.setElement(device, Mqtt.ParsePayload(value));
      break;
    }
  }
  if (found_room === false) {
    var new_room = document.createElement('draw-container');
    content_element.appendChild(new_room);
    new_room.draw_name = room;

    new_room.setElement(device, Mqtt.ParsePayload(value));
  }
};

Mqtt.ParsePayload = function(payload) {
  return_value = {};

  var key_counter = 0;

  var payload_array = payload.split(',');

  for (var i = 0; i < payload_array.length; i++) {
    var key, value;
    if(payload_array[i].split(':').length > 1) {
      // payload in the format "R: 123,G: 456,B: 789".
      key = payload_array[i].split(':')[0].trim();
      value = payload_array[i].split(':')[1].trim();
    } else {
      key = key_counter;
      key_counter++;
      value = payload_array[i].trim();
      if(value.split('#').length > 1){
        // '#89a' type hex format.
        value = '0x' + value.split('#')[1];
      } else if (value === 'on') {
        value = '0xff'
      } else if (value === 'off') {
        value = '0x00'
      }
    }
    if(value){
      return_value[key] = parseInt(value);
    }
  }

  return return_value;
}

Mqtt.send = function(data, send_topic) {
  message = new Messaging.Message(data);
  message.destinationName = send_topic;
  message.qos = 0;
  Mqtt.broker.send(message);
};


window.onload = function() {
  Page.init();
  Page._intervalId_ = setInterval(Page.run, 1000 / Page.fps_);
  Mqtt.MQTTconnect();
};

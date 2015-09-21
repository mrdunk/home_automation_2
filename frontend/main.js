

var Page = {}

Page.init = function() {
  Page.running_ = true;
  Page.fps_ = 10;
  Page.log_ = document.getElementById("ha-container-log").getElementsByClassName("draw-elements")[0];
  Page.topics = {};
  Page.topics.all_devices = 'homeautomation/0/all/all';
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
  Mqtt.broker = new Messaging.Client( BROKER_ADDRESS, BROKER_PORT, "web_" + parseInt(Math.random() * 100, 10));
  var options = {
      timeout: 3,
      useSSL: USE_TLS,
      cleanSession: CLEANSESSION,
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
  console.log("Host="+ BROKER_ADDRESS + ", port=" + BROKER_PORT + " TLS = " + USE_TLS + " username=" + username + " password=" + password);
  Mqtt.broker.connect(options);
}

Mqtt.onConnect = function() {
  console.log('Connected to ' + BROKER_ADDRESS + ':' + BROKER_PORT);
  Mqtt.broker.subscribe(ANNOUNCE_SUBSCRIPTION, {qos: 0});
  console.log('Subscribed to topic: ' + ANNOUNCE_SUBSCRIPTION);

  Page.AppendToLog(Page.topics.all_devices + " = command:solicit", 'RED');
  Mqtt.send(Page.topics.all_devices, "command:solicit");

}

Mqtt.onConnectionLost = function(response) {
  setTimeout(Mqtt.MQTTconnect, Mqtt.reconnectTimeout);
  console.log("connection lost: " + response.errorMessage + ". Reconnecting");
};

Mqtt.onMessageArrived = function(message) {
  var topic = message.destinationName;

  // Make sure only valid characters are in payload with "match()".
  var regex = /^([\w/]+)\s*:\s*(\w+)\s*$/
  var regex_results = regex.exec(message.payloadString)

  Page.AppendToLog(topic + ' = ' + message.payloadString)

  if(regex_results !== null && regex_results[0] === message.payloadString){
    var address = regex_results[1] 
    var command = regex_results[2]
    Page.AppendToLog("  payload parsed as: {address: " + address + ", command: " + command + "}", "yellow")
    document.getElementById('ha-container-lighting').addChild(address, command)
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

Mqtt.send = function(send_topic, data) {
  message = new Messaging.Message(data);
  message.destinationName = send_topic;
  message.qos = 0;
  Mqtt.broker.send(message);
};


window.onload = function() {
  Page.init();
  Page._intervalId_ = setInterval(Page.run, 1000 / Page.fps_);
  Mqtt.MQTTconnect();
  console.log("done window.onload")
};



var Page = {}

Page.init = function() {
  Page.running_ = true;
  Page.fps_ = 10;
  Page.log_ = document.getElementById("ha-container-log").getElementsByClassName("ha-container-children")[0];
  Page.log_.className = Page.log_.className + " ha-container-log-content"
  Page.topics = {};
  Page.topics.all_devices = 'homeautomation/0/_all/_all';
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
  Mqtt.broker = new Paho.MQTT.Client( BROKER_ADDRESS, BROKER_PORT, "web_" + parseInt(Math.random() * 100, 10));
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
  Mqtt.broker.subscribe(ANNOUNCE_SUBSCRIPTION, {qos: 1});
  console.log('Subscribed to topic: ' + ANNOUNCE_SUBSCRIPTION);

  Page.AppendToLog(Page.topics.all_devices + " = _command:solicit", 'RED');
  Mqtt.send(Page.topics.all_devices, "_command : solicit");

}

Mqtt.onConnectionLost = function(response) {
  setTimeout(Mqtt.MQTTconnect, Mqtt.reconnectTimeout);
  console.log("connection lost: " + response.errorMessage + ". Reconnecting");
};


Mqtt.onMessageArrived = function(message) {
  // Make sure topic looks like valid MQTT addresses.
  var regex_topic = /^(\w+\/?)+$/ ;
  var topic;
  if (message.destinationName.match(regex_topic)) {
    topic = regex_topic.exec(message.destinationName)[0];
  }
  if (!topic) {
    console.log('Mqtt.onMessageArrived: Malformed topic: ' + message.destinationName);
    return;
  }

  var data;
  var regex_data = /^s*([\s\w\/:,_]+)s*$/ ;
  if (message.payloadString.match(regex_data)) {
    data = regex_data.exec(message.payloadString)[0];
  }
  if (!data) {
    console.log('Mqtt.onMessageArrived: Illegal character in payload: ' + message.payloadString);
    return;
  }

  // data will be a list of key:value pairs, separated by a colon (:).
  // eg the following is valid:
  //    _subject : users/104167545338599232229, _count : 1, _display_name : Duncan Law
  // Ideally there will be a _subject key and the value should be a valid topic fragment.
  // If no _subject is set, we can presume the packet applies to the address of the topic.
  data = data.replace(/:/g, ' : ');
  data = data.replace(/,/g, ' , ');
  data = data.split(' ');

  var data_object = {};
  var key_or_val;
  for(var index in data){
    if (data[index] === ''){
      // pass.
    } else if(!key_or_val){
      if (data[index][0] !== '_') {
        console.log('Mqtt.onMessageArrived: Incorrectly formed key: ' + data[index] + '. Expected to start with "_".');
        return;
      }
      key_or_val = data[index];
    } else if (data[index] === ':') {
      // pass.
    } else if (data[index] === ','){
      // Next key:value pair.
      key_or_val = undefined;
    } else if (!data_object[key_or_val]) {
      data_object[key_or_val] = data[index];
    } else {
      // Append data.
      data_object[key_or_val] += ' ' + data[index];
    }
  }

  // The "_subject" in data_object refers to the target that this MQTT packet is about and
  // should also look like a topic.
  if (!data_object._subject.match(regex_topic)) {
    console.log('Mqtt.onMessageArrived: Malformed _subject: ' + data_object._subject);
    return;
  }

  console.log(topic + ' = ', data_object);
  Page.AppendToLog(topic + ' = ' + JSON.stringify(data_object));

  if(data_object._subject && data_object._state){
    Page.AppendToLog('  payload parsed as: {_subject: ' + data_object._subject + ', _state: ' + data_object._state + '}', 'yellow');
    document.getElementById('ha-container-lighting').addChild(data_object._subject, data_object._state);
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
  message = new Paho.MQTT.Message(data);
  message.destinationName = send_topic;
  message.qos = 1;
  Mqtt.broker.send(message);
};


window.onload = function() {
  Page.init();
  Page._intervalId_ = setInterval(Page.run, 1000 / Page.fps_);
  Mqtt.MQTTconnect();
  console.log("done window.onload")
};

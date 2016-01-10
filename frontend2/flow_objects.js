/*global Data*/

/*global PORT_WIDTH*/
/*global PORT_HEIGHT*/

var SNAP = 20;

var INPUT_PORT = { description: 'Trigger label', value: '_any', updater: 'ha-general-attribute' };

var shareBetweenShapes = {unique_id: 0};


/* Descend into object, returning child if it exists. */
var getPath = function(object, path) {
  'use strict';
  var parts = path.split('.');
  for(var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if(object[p] === undefined) {
      return;
    }
    object = object[p];
  }
  return object;
}

/* Descend into object, returning child if it exists and creating it if not */
var addPath = function(object, path) { 
  'use strict';
  var parts = path.split('.');
  for(var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if(object[p] === undefined) {
      object[p] = {};
    }
    object = object[p];
  }
  return object;
}


var getFlowObjectByUniqueId = function(unique_id){
  'use strict';
  return document.getElementsByTagName('ha-control')[0].flowObjects[unique_id];
};

var getFlowObjectByInstanceName = function(instance_name){
  'use strict';
  var flowObjects = document.getElementsByTagName('ha-control')[0].flowObjects;
  for(var index in flowObjects){
    if(flowObjects[index].data.data.general.instance_name.value === instance_name){
      return flowObjects[index];
    }
  }
  return;
};

var setLink = function(link_data){
  //console.log('setLink(', link_data, ')');
  var link, shape;
  var paper = document.getElementsByTagName('ha-control')[0].paper;
  var links = document.getElementsByTagName('ha-control')[0].links;
  for(var i = 0; i < links.length; i++){
    if(links[i].data.source_object === link_data.source_object &&
        links[i].data.source_port === link_data.source_port &&
        links[i].data.destination_object === link_data.destination_object &&
        links[i].data.destination_port === link_data.destination_port){
      link = links[i];
      break;
    }
  }
  var source_object = getFlowObjectByUniqueId(link_data.source_object);
  var source_port_shape = getPortShape(link_data.source_object, link_data.source_port);
  var destination_port_shape = getPortShape(link_data.destination_object, link_data.destination_port);
  if(source_port_shape && destination_port_shape){
    var source_port_position = source_port_shape.getShapePosition();
    var destination_port_position = destination_port_shape.getShapePosition();
    source_port_position.x += source_port_shape.getBBox().width;
    source_port_position.y += source_port_shape.getBBox().height / 2;
    //destination_port_position.x -= destination_port_shape.getBBox().width;
    destination_port_position.y += destination_port_shape.getBBox().height / 2;
    shape = paper.arrow(source_port_position, destination_port_position, 'teal');
  }
  if(link === undefined){
    link = {data: link_data, shape: shape};
    document.getElementsByTagName('ha-control')[0].links.push(link);
  } else {
    if(link.shape){
      link.shape.remove();
    }
    link.shape = shape;
  }
}

var FlowObject = function(paper, sidebar){
  'use strict';
  //console.log('FlowObject', this);

  this.data = {label: 'FlowObject',
               data: {outputs: {}, inputs: {}}};
  this.paper = paper;
  this.sidebar = sidebar;
};

FlowObject.prototype.updateLinks = function(){
  //console.log('FlowObject.prototype.updateLinks');
  var links = document.getElementsByTagName('ha-control')[0].links;
  for(var i = 0; i < links.length; i++){
    if(links[i].data.source_object === this.data.unique_id || links[i].data.destination_object === this.data.unique_id){
      setLink(links[i].data);
    }
  }
}

FlowObject.prototype.setShape = function(shape){
  'use strict';
  this.shape = shape || paper.rect(0, 0, 30, 30, 5);
  this.shape.data('object_id', this.data.unique_id);
  this.shape.drag(this.onmove, this.onstart, this.onend);
  this.shape.mouseover(this.onmouseover);
  this.shape.mouseout(this.onmouseout);
  this.shape.mouseup(this.onmouseup);
  this.shape.setInputs(this);
  this.shape.setOutputs(this);
};

FlowObject.prototype.delete = function(removeLinks){
  'use strict';
  console.log('FlowObject.prototype.delete');

  if(shareBetweenShapes.selected === this.data.unique_id){
    shareBetweenShapes.selected = undefined;
  }
  this.shape.remove();
  
  if(removeLinks === undefined || removeLinks === true){
    var links_to_remove = [];
    var links = document.getElementsByTagName('ha-control')[0].links;
    for(var i = 0; i < links.length; i++){
      if(links[i].data.source_object === this.data.unique_id){
        links_to_remove.push(i);
        if(links[i].shape){
          links[i].shape.remove();
        }
      }
      if(links[i].data.destination_object === this.data.unique_id){
        links_to_remove.push(i);
        if(links[i].shape){
          links[i].shape.remove();
        }
        // Also need to remove from other end of link.
        var source_object = getFlowObjectByUniqueId(links[i].data.source_object);
        for(var j in source_object.data.data.outputs){
          if(source_object.data.data.outputs[j].port_label === links[i].data.source_port){
            var outputs_to_remove = [];
            for(var k = 0; k < source_object.data.data.outputs[j].links.length; k++){
              if(source_object.data.data.outputs[j].links[k].source_port === links[i].data.source_port &&
                  source_object.data.data.outputs[j].links[k].destination_port === links[i].data.destination_port){
                console.log(i, j, k, links[i].data);
                outputs_to_remove.push(k);
              }
            }
            while(outputs_to_remove.length){
              source_object.data.data.outputs[j].links.splice(outputs_to_remove.pop(), 1);
            }
          }
        }
      }
    }
    while(links_to_remove.length){
      document.getElementsByTagName('ha-control')[0].links.splice(links_to_remove.pop(), 1);
    }
  }

  delete document.getElementsByTagName('ha-control')[0].flowObjects[this.data.unique_id];
}

FlowObject.prototype.setInstanceName = function(instance_name){
  'use strict';
  instance_name = instance_name || 'Object_' + shareBetweenShapes.unique_id;
  var append_to_name = 1;
  var instance_name_base = instance_name;

  while(this.data.data.general.instance_name.value !== instance_name){
    if(getFlowObjectByInstanceName(instance_name) === undefined){
      this.data.data.general.instance_name.value = instance_name;
      break;
		}
    append_to_name++;
    instance_name = instance_name_base + '_' + append_to_name;
  }

  this.setContents(this.data);
};

FlowObject.prototype.setup = function(backend_data){
  'use strict';
  console.log('FlowObject.setup(', backend_data, ')');

  if(backend_data.version === undefined){
    backend_data.version = 0;
  }
  if(backend_data.version){
    this.data.version = backend_data.version;
  }

  if(backend_data.unique_id){
    this.data.unique_id = backend_data.unique_id;
  } else {
    shareBetweenShapes.unique_id++;
    this.data.unique_id = this.constructor.name + '_' + shareBetweenShapes.unique_id + session_uid();
  }
  document.getElementsByTagName('ha-control')[0].flowObjects[this.data.unique_id] = this;

	this.setShape(this.shape);

  for(var port_out in this.data.data.outputs){
    this.data.data.outputs[port_out].links = [];
  }

  this.setInstanceName(backend_data.instance_name);

  if(getPath(backend_data, 'shape.position') !== undefined){
    this.setBoxPosition(backend_data.shape.position.x, backend_data.shape.position.y);
  }

  // Make sure object is marked selected if it has been replaced.
  if(shareBetweenShapes.selected === this.data.unique_id){
    this.select();
  }
};

FlowObject.prototype.setContents = function(contents){
  'use strict';
  contents = contents || this.data;
  
  this.data.version = this.data.version || 0;

  this.shape.setContents(contents);
};

FlowObject.prototype.setInputs = function(){
  'use strict';
  this.shape.setInputs();
  this.shape.drag(this.onmove, this.onstart, this.onend);
};

FlowObject.prototype.setOutputs = function(){
  'use strict';
  this.shape.setOutputs();
  this.shape.drag(this.onmove, this.onstart, this.onend);
};

FlowObject.prototype.getBoxPosition = function(){
  'use strict';
  return this.shape[0].getBoxPosition();
};

FlowObject.prototype.setBoxPosition = function(x, y){
  'use strict';
  console.log('FlowObject.setBoxPosition(', x, y, ')');
  if(isNaN(parseFloat(x)) && y === undefined){
    // Has been passed a position object: {x: X_coord, y: Y_coord}.
    y = x.y;
    x = x.x;
  }
  this.shape[0].setBoxPosition(x, y);
};

FlowObject.prototype.select = function(){
  'use strict';
  console.log('FlowObject.select:', this);
  if(shareBetweenShapes.selected !== undefined){
    getFlowObjectByUniqueId(shareBetweenShapes.selected).shape.setHighlight(false);
  }
  this.shape.setHighlight(true);
  shareBetweenShapes.selected = this.data.unique_id;

  this.displaySideBar();
};

FlowObject.prototype.displaySideBar = function(){
  'use strict';
  console.log('FlowObject.displaySideBar()');

  // Header
  var header_content = document.createElement('div');
  var header_text = document.createElement('span');
  header_text.className = 'text';
  var header_icon = document.createElement('span');
  header_icon.className = 'object-color';
	header_content.appendChild(header_text);
  header_content.appendChild(header_icon);

	var h1 = document.createElement('div');
	var h2 = document.createElement('div');
  var h3 = document.createElement('a');
	h1.innerHTML = this.data.data.general.instance_name.value;
	h2.innerHTML = this.data.unique_id + ' ' + this.data.version;
  h3.innerHTML = 'delete';
  h3.onclick=function(){console.log(this);
                        this.delete();
                       }.bind(this);
  header_text.appendChild(h1);
  header_text.appendChild(h2);
  header_text.appendChild(h3);

  if(this.getColor() === undefined){
    header_icon.style.height = '0';
    header_icon.style.visibility = "hidden";
  } else {
    header_icon.style.height = '2em';
    header_icon.style.visibility = "visible";
    header_icon.style.background = this.getColor();
  }

  this.sidebar.setHeader(header_content);

  // Content
  var flowobject_data = document.createElement('ha-flowobject-data');
  flowobject_data.populate(this.data.data, this);
  this.sidebar.setContent(flowobject_data);
};

FlowObject.prototype.onmouseover = function(){
  'use strict';
  //console.log(this.getIdentity());
  if(shareBetweenShapes.dragging){
    var clicked_shape = this.getIdentity();
    if(clicked_shape.type === 'input'){
      shareBetweenShapes.linked = {source_object: shareBetweenShapes.dragging.source_object, source_port: shareBetweenShapes.dragging.source_port,
                                   destination_object: clicked_shape.object_id, destination_port: clicked_shape.port_label};
      this.animate({"fill-opacity": 0.2}, 500);
    }
  }
};

FlowObject.prototype.onmouseout = function(){
  'use strict';
  var clicked_shape = this.getIdentity();
  if(shareBetweenShapes.dragging && clicked_shape.object_id !== shareBetweenShapes.dragging.source_object){
    this.animate({"fill-opacity": 1}, 500);

    delete shareBetweenShapes.linked;
  }
};

FlowObject.prototype.onmouseup = function(){
  'use strict';
  this.animate({"fill-opacity": 1}, 500);
};

FlowObject.prototype.onmove = function(dx, dy){
  'use strict';
  //console.log('FlowObject.onmove(', dx, dy, ')');

  if(!this.timer){
    this.timer = setTimeout(do_periodically.bind(this), 40);
  }

  function do_periodically(){
    if(this.data('type') === 'parent' || this.data('type') === 'body'){
      //console.log('do_periodically');
      this.setBoxPosition(dx + this.start_move_x, dy + this.start_move_y);
    } else if(shareBetweenShapes.dragging){
      var path = shareBetweenShapes.dragging.arrow.attr('path');
      var pos2 = {x: path[0][1] + dx, y: path[0][2] + dy};
      shareBetweenShapes.dragging.arrow.dragArrow(pos2);
    }
    this.timer = null;
  }
};

// TODO: move out of FlowObject name-space.
FlowObject.prototype.onstart = function(){
  'use strict';
  //console.log('FlowObject.onstart()', this);
  
  var clicked_shape = this.getIdentity();
  var object = getFlowObjectByUniqueId(clicked_shape.object_id);

  object.select();
  this.animate({"fill-opacity": 0.2}, 500);

  if(clicked_shape.type === 'parent' || clicked_shape.type === 'body'){
    this.start_move_x = this.attr("x");
    this.start_move_y = this.attr("y");
  } else if(clicked_shape.type === 'input'){
  } else if(clicked_shape.type === 'output'){
    var pos1 = this.getShapePosition();
    pos1.x = pos1.x + PORT_WIDTH;
    pos1.y = pos1.y + PORT_HEIGHT /2;
    var pos2 = {x: pos1.x + 5, y: pos1.y};
    shareBetweenShapes.dragging = {arrow: this.paper.arrow(pos1, pos2, 'red'), source_object: clicked_shape.object_id, source_port: clicked_shape.port_label};
    shareBetweenShapes.dragging.arrow.node.setAttribute("pointer-events", "none");
  }
};

FlowObject.prototype.onend = function(){
  'use strict';
  //console.log('FlowObject.onend()');
  this.animate({"fill-opacity": 1}, 500);
  
  var clicked_shape = this.getIdentity();
  var object = getFlowObjectByUniqueId(clicked_shape.object_id);

  if(shareBetweenShapes.dragging && shareBetweenShapes.dragging.arrow){
    shareBetweenShapes.dragging.arrow.remove();  
    delete shareBetweenShapes.dragging;

    if(shareBetweenShapes.linked){
      //console.log(shareBetweenShapes.linked);
      object.linkOutToIn(shareBetweenShapes.linked);
      delete shareBetweenShapes.linked;
    }
  } else {
    // Finished dragging FlowObject.
    if(this.timer){
      window.clearTimeout(this.timer);
      this.timer = undefined;
    }
    var position = object.getBoxPosition();
    position.x += SNAP /2 - position.x % SNAP;
    position.y += SNAP /2 - position.y % SNAP;
    object.setBoxPosition(position);
    object.ExportObject();
  }
};

FlowObject.prototype.linkOutToIn = function(link_data){
  'use strict';
  console.log('FlowObject.linkOutToIn(', link_data, ')');

  var source_port = link_data.source_port;
  var destination_object = link_data.destination_object;
  var destination_port = link_data.destination_port;

  if(!source_port || !destination_object || !destination_port){
    return;
  }

  for(var port_index in this.data.data.outputs){
    if(this.data.data.outputs[port_index].port_label === source_port){
      var source_port_data = this.data.data.outputs[port_index];
      var found = false;
      for(var i = 0; i < source_port_data.links.length; i++){
        if(source_port_data.links[i].source_port === source_port &&
           source_port_data.links[i].destination_object === destination_object &&
           source_port_data.links[i].destination_port === destination_port){
          // Already has this link.
          found = true;
          break;
        }
      }
      if(!found){
        console.log('LINK!');
        source_port_data.links.push({source_port: source_port, destination_object: destination_object, destination_port: destination_port});
        this.ExportObject();
      }
      break;
    }
  }

  this.shape.setOutputLinks(this.data.data.outputs);
};


FlowObject.prototype.setRadius = function(radius){
  'use strict';
  this.shape.attr({'r': radius});
};

FlowObject.prototype.setColor = function(color){
  'use strict';
  this.shape.attr("fill", color);
  this.shape.attr("stroke", "#000");
};

FlowObject.prototype.getColor = function(){
  'use strict';
  return this.shape[0].attr("fill");
};

FlowObject.prototype.ExportObject = function(send_object){
  'use strict';
  this.data.version += 1;

  send_object = send_object || {data: {inputs: {}, outputs: {}, general: {}}};
  send_object.unique_id = this.data.unique_id;
  send_object.instance_name = this.data.data.general.instance_name.value;
  send_object.version = this.data.version;
  send_object.shape = this.data.shape;
  send_object.shape.position = this.shape.getShapePosition();

  for(var object_name in flow_objects){
    if(flow_objects[object_name].name === this.constructor.name){
      send_object.object_name = object_name;
    }
  }

  for(var output in this.data.data.outputs){
    for(var i = 0; i < this.data.data.outputs[output].links.length; i++){
      var link_to_unique_id = this.data.data.outputs[output].links[i];
      var link_to_port = this.data.data.outputs[output].links[i].source_port || 'default';
      if(send_object.data.outputs[link_to_port] === undefined){
        send_object.data.outputs[link_to_port] = [];
      }
      send_object.data.outputs[link_to_port].push(link_to_unique_id);
    }
  }

  for(var general_name in this.data.data.general){
    if(general_name !== 'instance_name'){
		  send_object.data.general[general_name] = this.data.data.general[general_name].value;
    }
	}

  //console.log('**', JSON.stringify(send_object));
  //console.log('**', JSON.stringify(this.data));
  Mqtt.send('homeautomation/0/control/_announce', JSON.stringify(send_object));

  return send_object;
};



// Must be used *before* re-defining any class methods.
var inheritsFrom = function (child, parent) {
  'use strict';
  child.prototype = Object.create(parent.prototype);
  child.prototype.$super = parent.prototype;
  child.prototype.constructor = child;
};


flow_object_classes = [FlowObjectMqttSubscribe, FlowObjectMqttPublish, FlowObjectReadFile, FlowObjectMapValues, FlowObjectMapLabels, FlowObjectTimer, FlowObjectCombineData, FlowObjectAddData];


function FlowObjectMqttSubscribe(paper, sidebar, shape, backend_data){
  'use strict';
  console.log("FlowObjectMqttSubscribe");

  FlowObject.prototype.constructor.call(this, paper, sidebar);

  this.data = { label: 'MQTT Subscription',
                description: 'Monitor MQTT for a specific topic.',
                shape: {
                  width: 100,
                  height: 50,
                  color: 'seagreen',
                },
                data: {
                  general: {
                    instance_name: { 
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      },
                    subscribed_topic: {
                      description: 'MQTT topic subscription',
                      updater: 'ha-topic-chooser',
                      value: 'homeautomation/#'
                    }},
                  inputs: {},
                  outputs: {
                    0: {
                      description: 'Default output',
                      port_label: 'default_out',
                      sample_data: {}
                      } } }
              };

  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);

    if(getPath(backend_data, 'data.general.subscribed_topic') !== undefined){
      this.data.data.general.subscribed_topic.value = 'homeautomation/+/' + backend_data.data.general.subscribed_topic;
      this.setContents();
    }
  }
};

inheritsFrom(FlowObjectMqttSubscribe, FlowObject);

FlowObjectMqttSubscribe.prototype.setContents = function(contents){
  'use strict';
	// Update sample_data according to subscribed topic.
  this.data.data.outputs[0].sample_data = {};
	var topic = this.data.data.general.subscribed_topic.value.split('/').slice(2).join('/');
	var topics = Data.GetMatchingTopics(topic);
	for(var i = 0; i < topics.length; i++){
		console.log(Data.mqtt_data[topics[i]]);
		for(var j = 0; j < Data.mqtt_data[topics[i]].length; j++){
			var sample_payload = Data.mqtt_data[topics[i]][j];
			this.data.data.outputs[0].sample_data[sample_payload._subject] = sample_payload;
		}
	}

  this.$super.setContents.call(this, contents);
};

FlowObjectMqttSubscribe.prototype.ExportObject = function(){
  'use strict';
  // TODO need to modify subscribed_topic before we call this.$super.ExportObject()
  var send_object = this.$super.ExportObject.call(this, send_object);

  send_object.data.general.subscribed_topic = this.data.data.general.subscribed_topic.value;
  send_object.data.general.subscribed_topic.replace('homeautomation/+/', '');
}



function FlowObjectMqttPublish(paper, sidebar, shape, backend_data){
  'use strict';
  console.log("FlowObjectMqttPublish");

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { label: 'MQTT Publish',
                description: 'Publish MQTT a message for a specific topic.',
                shape: {
                  width: 100,
                  height: 50,
                  color: 'seagreen',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      },
                    publish_topic: {
                      description: 'MQTT topic to Publish to',
                      updater: 'ha-general-attribute',
                      value: 'homeautomation/test' },
                    payload_passthrough: {
                      description: 'Use Input payload as Output.',
                      updater: 'ha-general-attribute',
                      value: true },
                    payload_custom: {
                      description: 'Custom string to send as payload.',
                      updater: 'ha-general-attribute',
                      value: '42' },
                    },
                  inputs: {
                    0: {
                      description: 'Publish',
                      port_label: 'default_in',
                      tag: 'publish',
                      sample_data: {},
                      trigger_success: [] }},
                  outputs: {}}
              };
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);
  }
};

inheritsFrom(FlowObjectMqttPublish, FlowObject);



function FlowObjectTimer(paper, sidebar, shape, backend_data){
  'use strict';
  console.log("FlowObjectTimer");

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { label: 'Timer',
                description: 'Trigger output after a set delay.',
                shape: {
                  width: 100,
                  height: 50,
                  color: 'coral',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id 
                      },
                    period: {
                      description: 'Time between output trigger. (seconds)',
                      updater: 'ha-general-attribute',
                      value: '10'
                    },
                    run_at_start: {
                      description: 'Timer running at startup?',
                      updater: 'ha-general-attribute',
                      value: true,
                    },
                    repeated: {
                      description: 'Restart automatically after triggering?',
                      updater: 'ha-general-attribute',
                      value: true,
                    }},
                  inputs: {
                    0: {
                      description: 'Start',
                      port_label: 'start_in',
                      peramiters:{
                        trigger_label: INPUT_PORT,
                        trigger_value: INPUT_PORT,
                      },
                      sample_data: {},
                      },
                    1: {
                      description: 'Stop',
                      port_label: 'stop_in',
                      peramiters:{
                        trigger_label: INPUT_PORT,
                        trigger_value: INPUT_PORT
                      },
                      sample_data: {},
                      },
                    2: {
                      description: 'Reset',
                      port_label: 'reset_in',
                      peramiters:{
                        trigger_label: INPUT_PORT,
                        trigger_value: INPUT_PORT
                      },
                      sample_data: {},
                      }},
                  outputs: {
                    0: {
                      description: 'Default output',
                      peramiters:{
                        output_label: {
                          description: 'Ouput label',
                          updater: 'ha-general-attribute',
                          label: 'ouput_label',
                          value: '_default' },
                        output_data: {
                          description: 'Ouput data',
                          updater: 'ha-general-attribute',
                          label: 'ouput_data',
                          value: true },
                        },
                      sample_data: {},
                      } } }
              };
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);
  }
};

inheritsFrom(FlowObjectTimer, FlowObject);


function FlowObjectMapValues(paper, sidebar, shape, backend_data){
  'use strict';
  console.log("FlowObjectMapValues(", backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { label: 'Map values',
                description: 'Filter or modify input variables to different output.',
                shape: {
                  width: 75,
                  height: 50,
                  color: 'crimson',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      },
                    },
                  inputs: {
                    0: {
                      description: 'Input 1',
                      port_label: 'default_in',
                      peramiters: {
                        transitions: {
                          description: 'Map Input ranges to desired Output.',
                          updater: 'ha-transitions',
                          port_out: 0,
                          values: {} }
                        },
                      sample_data: {}
                      },
                    },
                  outputs: {
                    0: {
                      description: 'Default output',
                      port_label: 'default_out',
                      sample_data: {}
                      }
                    }}};
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);

    if(getPath(backend_data, 'data.inputs.default_in.label') !== undefined){
      var label = backend_data.data.inputs.default_in.label;
      this.data.data.inputs[0].peramiters.transitions.values[label] = [];
      var found_else;
      for(var key in backend_data.data.inputs.default_in.rules){
        var input = backend_data.data.inputs.default_in.rules[key].match;
        if(typeof(input) === 'string' && input.toLowerCase().trim() === 'true'){
          input = true;
        }
        if(typeof(input) === 'string' && input.toLowerCase().trim() === 'false'){
          input = false;
        }
        var output = backend_data.data.inputs.default_in.rules[key].action;
        if(output === '_string'){
          output = backend_data.data.inputs.default_in.rules[key].value;
        }
        this.data.data.inputs[0].peramiters.transitions.values[label].push({input: input, output: output});
        if(input === '_else'){
          found_else = true;
        }
      }
      if(found_else === undefined){
        this.data.data.inputs[0].peramiters.transitions.values[label].push({input: '_else', output: '_drop'});
      }
    }
  }
};

inheritsFrom(FlowObjectMapValues, FlowObject);

var stringToBoolean = function(string){
  'use strict';
  switch(String(string).toLowerCase().trim()){
    case "true": return true;
    case "false": return false;
    //case "true": case "yes": case "1": return true;
    //case "false": case "no": case "0": case null: return false;
    default: return;
  }
};


function FlowObjectMapLabels(paper, sidebar, shape, backend_data){
  'use strict';
  console.log("FlowObjectMapLabels(", backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { label: 'Map labels',
                description: 'Modify labels names.',
                shape: {
                  width: 75,
                  height: 50,
                  color: 'crimson',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      },
                    },
                  inputs: {
                    0: {
                      description: 'Input 1',
                      port_label: 'default_in',
                      peramiters: {
                        label_in: {
                          description: 'Label to modify.',
                          updater: 'ha-general-attribute',
                          value: '' },
                        label_out: {
                          description: 'Desired label name.',
                          updater: 'ha-general-attribute',
                          value: '' }
                      },
                      sample_data: {}
                      },
                    },
                  outputs: {
                    0: {
                      description: 'Default output',
                      port_label: 'default_out',
                      sample_data: {}
                      }
                    }}};
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);
    if(getPath(backend_data, 'data.inputs.default_in.rules') !== undefined){
      // TODO handle more than one label.
      this.data.data.inputs[0].peramiters.else = {updater: "ha-general-attribute",
        description: "When no matching label."};
      var else_found;
      for(var key in backend_data.data.inputs.default_in.rules){
        var action = backend_data.data.inputs.default_in.rules[key].action;
        var match = backend_data.data.inputs.default_in.rules[key].match;
        var value = backend_data.data.inputs.default_in.rules[key].value;
        if(match === '_else'){
          if(action === '_string'){
            this.data.data.inputs[0].peramiters.else.value = value
          } else if(action === '_forward'){
            this.data.data.inputs[0].peramiters.else.value = match;
          } else if(action === '_drop'){
            this.data.data.inputs[0].peramiters.else.value = '_drop';
          }
        } else {
          else_found = true;
          this.data.data.inputs[0].peramiters.label_in.value = match;
          if(action === '_string'){
            this.data.data.inputs[0].peramiters.label_out.value = value
          } else if(action === '_forward'){
            this.data.data.inputs[0].peramiters.label_out.value = match;
          } else if(action === '_drop'){
            this.data.data.inputs[0].peramiters.label_out.value = '_drop';
          }
        }
      }
      if(else_found === undefined){
        this.data.data.inputs[0].peramiters.else.value = '_drop';
      }
    }
  }  
};

inheritsFrom(FlowObjectMapLabels, FlowObject);


function FlowObjectTestData(paper, sidebar, shape, backend_data){
  'use strict';
  console.log("FlowObjectTestData");

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { label: 'Test data',
                description: 'Generate some fake data for testing this UI.',
                shape: {
                  width: 100,
                  height: 50,
                  color: 'gold',
                },
                data: {
                  general: {
                    instance_name: { 
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      },
                    test_data: {
                      description: 'Test data',
                      updater: 'ha-general-attribute',
                      form_type: 'textarea',
                      update_on_change: true,
                      value: '[{"_subject":"dhcp/84_3a_4b_0c_11_6c","_google_id":"test_gid"}]'
                    }
                  },
                  inputs: {},
                  outputs: {
                    0: {
                      description: 'Default output',
                      port_label: 'default_out',
                      sample_data: {
                        'test/path/1': { '_subject': 'test/path/1', '_label1': 'string 1', '_label2': 'true', 'label3': 44},
                        'test/path/2': { '_subject': 'test/path/2', '_label1': 'String 2', '_label2': 'false', 'label3': 0},
                        'test/some_other_path': { '_subject': 'test/some_other_path', '_label2': 'false', 'label3': 1},
                        }
                      } } }
              };
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);
  }
};

inheritsFrom(FlowObjectTestData, FlowObject);

FlowObjectTestData.prototype.displaySideBar = function(){
  'use strict';
  this.data.data.outputs[0].sample_data = JSON.parse(this.data.data.general.test_data.value);

  this.$super.displaySideBar.call(this);
};



function FlowObjectCombineData(paper, sidebar, shape, backend_data){
  'use strict';
  console.log('FlowObjectCombineData(', paper, sidebar, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { label: 'Combine data',
                description: 'Combine data sharing specified label from multiple data payloads.',
                shape: {
                  width: 100,
                  height: 50,
                  color: 'cornflowerblue',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      }
                  },
                  inputs: {
                    0: {
                      description: 'Default input',
                      port_label: 'default_in',
											peramiters: {
                        primary_key: {
                          description: 'Primary key.',
                          updater: 'ha-select-label',
                          port_out: 0,
                          value: '' }
                        },
                      sample_data: {} 
                    },
                    // TODO add reset.
                  },
                outputs: {
                    0: {
                      description: 'Default output',
                      port_label: 'default_out',
                      sample_data: {}
                    }
                }
              }
	};
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);

    if(getPath(backend_data, 'data.inputs.default_in.primary_key_label') !== undefined){
      this.data.data.inputs[0].peramiters.primary_key.value = backend_data.data.inputs.default_in.primary_key_label
    }
  }
};

inheritsFrom(FlowObjectCombineData, FlowObject);



function FlowObjectAddData(paper, sidebar, shape, backend_data){
  'use strict';
  console.log('FlowObjectAddData(', paper, sidebar, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { label: 'Add data',
                description: 'Add data from multiple data payloads.',
                shape: {
                  width: 100,
                  height: 50,
                  color: 'cornflowerblue',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      }
                  },
                  inputs: {
                    0: {
                      description: 'Default input',
                      port_label: 'default_in',
											peramiters: {
                        primary_key: {
                          description: 'Primary key.',
                          updater: 'ha-select-label',
                          port_out: 0,
                          value: '' }
                        },
                      sample_data: {} 
                    },
                    // TODO add reset.
                  },
                outputs: {
                    0: {
                      description: 'Default output',
                      port_label: 'default_out',
                      sample_data: {}
                    }
                }
              }
	};
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);

    if(getPath(backend_data, 'data.inputs.default_in.primary_key_label') !== undefined){
      this.data.data.inputs[0].peramiters.primary_key.value = backend_data.data.inputs.default_in.primary_key_label
    }
  }
};

inheritsFrom(FlowObjectAddData, FlowObject);




function FlowObjectReadFile(paper, sidebar, shape, backend_data){
  'use strict';
  console.log('FlowObjectReadFile(', paper, sidebar, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { label: 'Read file',
                description: 'Read data from a file on disk.',
                shape: {
                  width: 100,
                  height: 50,
                  color: 'seagreen',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      },
                    filename: {
                      description: 'Filename',
                      updater: 'ha-general-attribute',
                      update_on_change: true,
                      value: ''
                    }
                  },
                  inputs: {
                    // TODO add trigger.
                  },
                outputs: {
                    0: {
                      description: 'Default output',
                      port_label: 'default_out',
                      sample_data: {}
                    }
                }
              }
	};
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);

    if(getPath(backend_data, 'data.general.filename') !== undefined){
      this.data.data.general.filename.value = backend_data.data.general.filename;
		}
  }
};

inheritsFrom(FlowObjectReadFile, FlowObject);



function FlowObjectAddTime(paper, sidebar, shape, backend_data){
  'use strict';
  console.log('FlowObjectAddTime(', paper, sidebar, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { label: 'Add time',
                description: 'Add time data to payload.',
                shape: {
                  width: 75,
                  height: 50,
                  color: 'gold',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      }
                  },
                  inputs: {
                    0: {
                      description: 'Default input',
                      port_label: 'default_in',
                      sample_data: {} 
                    },
                  },
                outputs: {
                    0: {
                      description: 'Default output',
                      port_label: 'default_out',
                      sample_data: {}
                    }
                }
              }
	};
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);
  }
};

inheritsFrom(FlowObjectAddTime, FlowObject);


/*global Data*/

/*global PORT_WIDTH*/
/*global PORT_HEIGHT*/

var SNAP = 20;

var INPUT_PORT = { description: 'Trigger label', value: '_any', updater: 'ha-general-attribute' };

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

var FlowObject = function(paper, sidebar, shareBetweenShapes){
  'use strict';
  //console.log('FlowObject', this);

  this.data = {object_name: 'FlowObject',
               data: {outputs: {}, inputs: {}}};
  this.paper = paper;
  this.sidebar = sidebar;
  this.shareBetweenShapes = shareBetweenShapes;
};

FlowObject.prototype.setShape = function(shape){
  'use strict';
  this.shape = shape || paper.rect(0, 0, 30, 30, 5);
  this.shape.data('parent', this);
  this.shape.drag(this.onmove, this.onstart, this.onend);
  this.shape.mouseover(this.onmouseover);
  this.shape.mouseout(this.onmouseout);
  this.shape.mouseup(this.onmouseup);
};

FlowObject.prototype.delete = function(){
  'use strict';
  this.shape.remove();
	this.deleteLinks();
  delete document.getElementsByTagName('ha-control')[0].flowObjects[this.unique_id];
}

FlowObject.prototype.setInstanceName = function(instance_name){
  'use strict';
  instance_name = instance_name || 'Object_' + this.shareBetweenShapes.unique_id;
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

  if(backend_data.version){
    this.version = backend_data.version;
  }

  for(var port_out in this.data.data.outputs){
    this.data.data.outputs[port_out].path = {};
    this.data.data.outputs[port_out].links = [];
  }
  for(var port_in in this.data.data.inputs){
    this.data.data.inputs[port_in].path = {};
    this.data.data.inputs[port_in].links = [];
    this.FilterInputToOutput(port_in);
  }

  if(backend_data.unique_id){
    this.unique_id = backend_data.unique_id;
  } else {
    this.shareBetweenShapes.unique_id++;
    this.unique_id = this.constructor.name + '_' + this.shareBetweenShapes.unique_id + session_uid();
  }
  document.getElementsByTagName('ha-control')[0].flowObjects[this.unique_id] = this;

  this.setInstanceName(backend_data.instance_name);

  if(backend_data.gui){
    this.setBoxPosition(backend_data.gui.position.x, backend_data.gui.position.y);
  }

  // Make sure object is marked selected if it has been replaced.
  if(this.shareBetweenShapes.selected && this.shareBetweenShapes.selected.unique_id === this.unique_id){
    this.select();
  }
};

FlowObject.prototype.replaceShape = function(newShape){
  'use strict';
  var pos = this.getBoxPosition();
  this.shape.remove();
  this.shape = newShape;

  this.shape.drag(this.onmove, this.onstart, this.onend);
  this.setBoxPosition(pos.x, pos.y);
};

FlowObject.prototype.setContents = function(contents){
  'use strict';
  console.log(contents, this.data);
  contents = contents || this.data;
  
  this.version = this.version || 0;

  this.shape.setContents(contents);
  //this.ExportObject();
};

FlowObject.prototype.setInputs = function(input_count){
  'use strict';
  this.shape.setInputs(input_count);
  this.shape.drag(this.onmove, this.onstart, this.onend);
};

FlowObject.prototype.setOutputs = function(output_count){
  'use strict';
  this.shape.setOutputs(output_count);
  this.shape.drag(this.onmove, this.onstart, this.onend);
};

FlowObject.prototype.getBoxPosition = function(){
  'use strict';
  return this.shape[0].getBoxPosition();
};

FlowObject.prototype.setBoxPosition = function(x, y){
  'use strict';
  if(isNaN(parseFloat(x)) && y === undefined){
    // Has been passed a position object: {x: X_coord, y: Y_coord}.
    y = x.y;
    x = x.x;
  }
  this.shape[0].setBoxPosition(x, y);
  //this.ExportObject();
};

FlowObject.prototype.select = function(){
  'use strict';
  console.log('FlowObject.select:', this);
  if(this.shareBetweenShapes.selected){
    this.shareBetweenShapes.selected.shape.setHighlight(false);
  }
  this.shape.setHighlight(true);
  this.shareBetweenShapes.selected = this;

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
	h2.innerHTML = this.unique_id + ' ' + this.version;
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
  if(this.data('parent').shareBetweenShapes.dragging){
    var clicked_shape = this.data('parent').mapShapeToPort(this);
    if(clicked_shape.type === 'inputs'){
      console.log('FlowObject.onmouseover', this, this.data('parent').shareBetweenShapes.dragging);
      this.data('parent').shareBetweenShapes.linked = {origin: this.data('parent').shareBetweenShapes.dragging.origin, desination: this};
      this.animate({"fill-opacity": 0.2}, 500);
    }
  }
};

FlowObject.prototype.onmouseout = function(){
  'use strict';
  if(this.data('parent').shareBetweenShapes.dragging && this.id !== this.data('parent').shareBetweenShapes.dragging.origin.id){
    console.log('FlowObject.onmouseout', this, this.data('myset'));
    this.animate({"fill-opacity": 1}, 500);
    delete this.data('parent').shareBetweenShapes.linked;
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
    this.timer = setTimeout(do_periodically.bind(this), 50);
  }

  function do_periodically(){
    console.log('tick');
    if(this.id === this.data('myset')[0].id){
      this.setBoxPosition(dx + this.start_move_x, dy + this.start_move_y);
    } else if(this.data('parent').shareBetweenShapes.dragging){
      var path = this.data('parent').shareBetweenShapes.dragging.arrow.attr('path');
      var pos2 = {x: path[0][1] + dx, y: path[0][2] + dy};
      this.data('parent').shareBetweenShapes.dragging.arrow.dragArrow(pos2);
    }
    this.timer = null;
  }
};

FlowObject.prototype.onstart = function(){
  'use strict';
  //console.log('FlowObject.onstart()', this, this.data('parent'));
  
  this.data('parent').select();
  this.animate({"fill-opacity": 0.2}, 500);

  var clicked_shape = this.data('parent').mapShapeToPort(this);
  if(clicked_shape.type === 'parent'){
    this.start_move_x = this.attr("x");
    this.start_move_y = this.attr("y");
  } else if(clicked_shape.type === 'inputs'){
  } else if(clicked_shape.type === 'outputs'){
    var pos1 = this.getShapePosition();
    pos1.x = pos1.x + PORT_WIDTH;
    pos1.y = pos1.y + PORT_HEIGHT /2;
    var pos2 = {x: pos1.x + 5, y: pos1.y};
    this.data('parent').shareBetweenShapes.dragging = {arrow: this.paper.arrow(pos1, pos2, 'red'), origin: this};
    this.data('parent').shareBetweenShapes.dragging.arrow.node.setAttribute("pointer-events", "none");
  }
};

FlowObject.prototype.onend = function(){
  'use strict';
  //console.log('FlowObject.onend()');
  this.data('myset').animate({"fill-opacity": 1}, 500);
  
  if(this.data('parent').shareBetweenShapes.dragging && this.data('parent').shareBetweenShapes.dragging.arrow){
    this.data('parent').shareBetweenShapes.dragging.arrow.remove();  
    delete this.data('parent').shareBetweenShapes.dragging;

    if(this.data('parent').shareBetweenShapes.linked){
      this.data('parent').linkOutToIn(this.data('parent').shareBetweenShapes.linked.origin, this.data('parent').shareBetweenShapes.linked.desination);
      delete this.data('parent').shareBetweenShapes.linked;
    }
  } else {
    // Finished dragging FlowObject.
    var position = this.data('parent').getBoxPosition();
    position.x += SNAP /2 - position.x % SNAP;
    position.y += SNAP /2 - position.y % SNAP;
    this.data('parent').setBoxPosition(position);
    this.data('parent').ExportObject();
  }
};

/* Arguments:
 *   Can take either the rectangle object provided by an event or an object containing
  *  enough information to find the port.
 *   eg: { unique_id: 'instance_id_1', port_number: 0}
         { flow_object: (object), port_number: 0}
 */
FlowObject.prototype.linkOutToIn = function(shape_out, shape_in){
  'use strict';
	console.log('FlowObject.linkOutToIn(', shape_out, shape_in, ')');
  if(shape_out.type !== 'rect'){
    if(shape_out.flow_object){
      shape_out = shape_out.flow_object.shape.getPort('outputs', shape_out.port_number);
    } else if(shape_out.unique_id){
      shape_out = getFlowObjectByUniqueId(shape_out.unique_id).shape.getPort('outputs', shape_out.port_number);
    } else {
      shape_out = this.shape.getPort('outputs', shape_out.port_number);
    }
  }
  if(shape_in.type !== 'rect'){
    if(shape_in.flow_object){
      shape_in = shape_in.flow_object.shape.getPort('inputs', shape_in.port_number);
    } else if(shape_in.unique_id){
      shape_in = getFlowObjectByUniqueId(shape_in.unique_id).shape.getPort('inputs', shape_in.port_number);
    } else {
      shape_in = this.shape.getPort('inputs', shape_in.port_number);
    }
  }
  console.log('FlowObject.linkOutToIn(', shape_out, shape_in, ')');

  var port_out = this.mapShapeToPort(shape_out);
  var port_in = shape_in.data('parent').mapShapeToPort(shape_in);

  // Check for the same link already existing.
  for(var i = 0; i < this.data.data.outputs[port_out.number].links.length; i++){
    if(this.data.data.outputs[port_out.number].links[i].box_object === shape_in.data('parent') && 
        this.data.data.outputs[port_out.number].links[i].input_port === port_in.number){
      console.log('DUPLICATE LINK');
      return;
    }
  }

  // Check for routing loops.
  var input_port_id = shape_in.data('parent').data.data.general.instance_name.value + '_in' + port_in.number;
  if(this.data.data.outputs[port_out.number].path[input_port_id] !== undefined){
    console.log('LOOP DETECTED!', input_port_id);
    return;
  }


  this.data.data.outputs[port_out.number].links.push({box_object: shape_in.data('parent'), input_port: port_in.number});
  shape_in.data('parent').data.data.inputs[port_in.number].links.push({box_object: this, output_port: port_out.number});

  this.shape.setOutputLinks(this.data.data.outputs);

  this.setAdjacentInputSamples(port_out.number, shape_in.data('parent'), port_in.number);
};

FlowObject.prototype.deleteLinks = function(){
  //console.log('FlowObject.deleteLinks');
  for(var i in this.data.data.outputs){
    while(this.data.data.outputs[i].links.length){
      var link = this.data.data.outputs[i].links.pop();
      console.log(link);

      // Now make a list of the far end nodes to remove the link from...
      var remove_links = [];
      for(var j in link.box_object.data.data.inputs){
        for(var k = 0; k < link.box_object.data.data.inputs[j].links.length; k++){
          if(link.box_object.data.data.inputs[j].links[k].box_object.unique_id === this.unique_id){
            remove_links.push([j, k]);
          }
        }
      }
      var link_indexes = remove_links.pop();
      link.box_object.data.data.inputs[link_indexes[0]].links.splice([link_indexes[1]], 1);
			// Re-draw links.
		  link.box_object.shape[0].setBoxPosition();
    }
  }

  for(var i in this.data.data.inputs){
    while(this.data.data.inputs[i].links.length){
      var link = this.data.data.inputs[i].links.pop();

      // Now make a list of the far end nodes to remove the link from...
      var remove_links = [];
      for(var j in link.box_object.data.data.outputs){
        for(var k = 0; k < link.box_object.data.data.outputs[j].links.length; k++){
          if(link.box_object.data.data.outputs[j].links[k].box_object.unique_id === this.unique_id){
            remove_links.push([j, k]);
          }
        }
      }
      var link_indexes = remove_links.pop();
      link.box_object.data.data.outputs[link_indexes[0]].links.splice([link_indexes[1]], 1);
      // Re-draw links.
      link.box_object.shape[0].setBoxPosition();
    }
  }
}

FlowObject.prototype.setAdjacentInputSamples = function(port_out, flow_object_in, port_in){
  'use strict';
  var port_out_list = [];
  if(port_out === undefined){
    for(port_out in this.data.data.outputs){
      port_out_list.push(port_out);
    }
  } else {
    port_out_list.push(port_out);
  }

  for(var index = 0; index < port_out_list.length; index++){
    port_out = port_out_list[index];

    if(flow_object_in !== undefined && port_in !== undefined ){
      this._setAdjacentInputSamples(port_out, flow_object_in, port_in);
    } else {
      if(this.data.data.outputs[port_out].links){
        for(var i = 0; i < this.data.data.outputs[port_out].links.length; i++){
          flow_object_in = this.data.data.outputs[port_out].links[i].box_object;
          port_in = this.data.data.outputs[port_out].links[i].input_port;

          this._setAdjacentInputSamples(port_out, flow_object_in, port_in);
        }
      }
    }
  }
};

FlowObject.prototype._setAdjacentInputSamples = function(port_out, flow_object_in, port_in){
  'use strict';
  // Record the path data has been through on the connected object.
  for(var port_id in this.data.data.outputs[port_out].path){
    flow_object_in.data.data.inputs[port_in].path[port_id] = true;
  }
  var this_port_id = this.data.data.outputs[port_out].path_source;
  if(this_port_id !== undefined){
    flow_object_in.data.data.inputs[port_in].path[this_port_id] = true;
  }

  // Copy the output data to the input of the connected object.
  var shape_out_name = this.data.data.general.instance_name.value;
  flow_object_in.data.data.inputs[port_in].sample_data[shape_out_name] = this.data.data.outputs[port_out].sample_data;

  // Update any objects connected to the target too.
  flow_object_in.FilterInputToOutput(port_in);
};

FlowObject.prototype.mapShapeToPort = function(shape){
  'use strict';
  var type, number, value;
  if(shape.id === shape.data('myset')[0].id){
    type = 'parent';
  } else {
    for(var i = 0; i < shape.data('myset').items.length; i++){
      for(var j = 0; j < shape.data('myset').items[i].length; j++){
        if(shape.id === shape.data('myset').items[i][j].id){
          // "shape" is this one.
          type = shape.data('myset').items[i].label;
          number = j;
          if(this.data.data && this.data.data[type] && this.data.data[type][number]){
            value = this.data.data[type][number].value;
          }
        }
      }
    }
  }
  //console.log('FlowObject.mapShapeToPort', type, number, value);
  return {type: type, number: number, value: value};
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

FlowObject.prototype.FilterInputToOutput = function(){
  'use strict';
};

FlowObject.prototype.ExportObject = function(send_object){
  'use strict';
  this.version += 1;

  send_object = send_object || {data: {inputs: {}, outputs: {}, general: {}}};
  send_object.unique_id = this.unique_id;
  send_object.instance_name = this.data.data.general.instance_name.value;
  send_object.version = this.version;
  send_object.gui = {position: this.shape.getShapePosition()};

  for(var class_name in flow_objects){
    if(flow_objects[class_name].name === this.constructor.name){
      send_object.class_name = class_name;
    }
  }

  for(var input in this.data.data.inputs){
    for(var i = 0; i < this.data.data.inputs[input].links.length; i++){
      var link_to_unique_id = this.data.data.inputs[input].links[i].box_object.unique_id;
      var link_to_port = this.data.data.inputs[input].links[i].port_name || 'default';
      if(send_object.data.inputs[link_to_port] === undefined){
        send_object.data.inputs[link_to_port] = [];
      }
      send_object.data.inputs[link_to_port].push(link_to_unique_id);
    }
  }

  for(var output in this.data.data.outputs){
    for(var i = 0; i < this.data.data.outputs[output].links.length; i++){
      var link_to_unique_id = this.data.data.outputs[output].links[i].box_object.unique_id;
      var link_to_port = this.data.data.outputs[output].links[i].port_name || 'default';
      if(send_object.data.outputs[link_to_port] === undefined){
        send_object.data.outputs[link_to_port] = [];
      }
      send_object.data.outputs[link_to_port].push(link_to_unique_id);
    }
  }

  for(var general_name in this.data.data.general){
    if(general_name !== 'instance_name'){
      // TODO Move instance_name out of data.data.general ?
		  send_object.data.general[general_name] = this.data.data.general[general_name].value;
    }
	}

  console.log('**', JSON.stringify(send_object));
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


function FlowObjectMqttSubscribe(paper, sidebar, shareBetweenShapes, shape, backend_data){
  'use strict';
  console.log("FlowObjectMqttSubscribe");

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes);

  this.data = { object_name: 'MQTT Subscription',
                description: 'Monitor MQTT for a specific topic.',
                shape: {
                  width: 150,
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
                      sample_data: {}
                      } } }
              };

  if(paper){
    shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, 0, 1, this.data.shape.color);
		this.setShape(shape);
    this.setup(backend_data);
    if(backend_data.data !== undefined){
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



function FlowObjectMqttPublish(paper, sidebar, shareBetweenShapes, shape, backend_data){
  'use strict';
  console.log("FlowObjectMqttPublish");

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes);
  this.data = { object_name: 'MQTT Publish',
                description: 'Publish MQTT a message for a specific topic.',
                shape: {
                  width: 150,
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
                      tag: 'publish',
                      sample_data: {},
                      trigger_success: [] }},
                  outputs: {}}
              };
  if(paper){
    shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, 1, 0, this.data.shape.color);
    this.setShape(shape);
    this.setup(backend_data);
  }
};

inheritsFrom(FlowObjectMqttPublish, FlowObject);



function FlowObjectTimer(paper, sidebar, shareBetweenShapes, shape, backend_data){
  'use strict';
  console.log("FlowObjectTimer");

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes);
  this.data = { object_name: 'Timer',
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
                      peramiters:{
                        trigger_label: INPUT_PORT,
                        trigger_value: INPUT_PORT,
                      },
                      sample_data: {},
                      },
                    1: {
                      description: 'Stop',
                      peramiters:{
                        trigger_label: INPUT_PORT,
                        trigger_value: INPUT_PORT
                      },
                      sample_data: {},
                      },
                    2: {
                      description: 'Reset',
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
                          value: '_default' },
                        output_data: {
                          description: 'Ouput data',
                          updater: 'ha-general-attribute',
                          value: true },
                        },
                      sample_data: {},
                      } } }
              };
  if(paper){
    shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, 3, 1, this.data.shape.color);
    this.setShape(shape);
    this.setup(backend_data);
  }
};

inheritsFrom(FlowObjectTimer, FlowObject);


function FlowObjectMapValues(paper, sidebar, shareBetweenShapes, shape, backend_data){
  'use strict';
  console.log("FlowObjectMapValues(", paper, sidebar, shareBetweenShapes, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes);
  this.data = { object_name: 'Map values',
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
                      sample_data: {}
                      }
                    }}};
  if(paper){
    shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, 1, 1, this.data.shape.color);
    this.setShape(shape);
    this.setup(backend_data);

    if(backend_data.data !== undefined){
      var label = backend_data.data.inputs.default.label;
      this.data.data.inputs[0].peramiters.transitions.values[label] = [];
      var found_else;
      for(var key in backend_data.data.inputs.default.rules){
        var input = backend_data.data.inputs.default.rules[key].match;
        if(typeof(input) === 'string' && input.toLowerCase().trim() === 'true'){
          input = true;
        }
        if(typeof(input) === 'string' && input.toLowerCase().trim() === 'false'){
          input = false;
        }
        var output = backend_data.data.inputs.default.rules[key].action;
        if(output === '_string'){
          output = backend_data.data.inputs.default.rules[key].value;
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

FlowObjectMapValues.prototype.FilterInputToOutput = function(port_in){
  'use strict';
  //console.log('FlowObjectMapValues.FilterInputToOutput(', port_in, ')', this.data.data);
  
  var port_out = this.data.data.inputs[port_in].peramiters.transitions.port_out;

  // Set the output port as having sourced data from the input.
  var this_port_id = this.data.data.general.instance_name.value + '_in' + port_in;
  this.data.data.outputs[port_out].path_source = this_port_id;

  // Copy the Input path to the Output.
  for(var input_port_id in this.data.data.inputs[port_out].path){
    this.data.data.outputs[port_out].path[input_port_id] = true;
  }
  this.data.data.outputs[port_out].path[this_port_id] = true;

  // Copy sample data from Input to Output, applying filters.
  //var filters = this.data.data.general.transitions.values;
  var filters = this.data.data.inputs[port_in].peramiters.transitions.values;

  var samples = {};
  var label;
  for(var sender in this.data.data.inputs[port_in].sample_data){
    for(var subject in this.data.data.inputs[port_in].sample_data[sender]){
      var payload = this.data.data.inputs[port_in].sample_data[sender][subject];
      var modified_payload = {};
      
      // Iterate through filters. There can be one for each label.
      // TODO: Allow configuration of more than one label.
      for(label in filters){
        var value = payload[label];
        var _value;
        // Now cycle through the filters for this label.
        for(var i = 0; i < filters[label].length; i++){
          var filter = filters[label][i];
          if(value !== undefined && typeof(filter.input) === 'boolean'){
            _value = stringToBoolean(value);
            if(_value === filter.input){
              modified_payload[label] = this.FilterOutput(_value, filter.output);
              break;
            }
          } else if(value !== undefined && filter.input === '_else'){
            // This filter is the default when no other filter matches.
            modified_payload[label] = this.FilterOutput(value, filter.output);
            break;
          } else if(value !== undefined && typeof(filter.input) === 'string'){
            _value = String(value);
            if(_value.trim() === filter.input.trim()){
              modified_payload[label] = this.FilterOutput(_value, filter.output);
              break;
            }
          } else if(value !== undefined && typeof(filter.input) === 'object'){
            _value = parseInt(value);
            console.log(value, _value, filter.input.low, filter.input.high);
            if(!isNaN(_value) && _value >= filter.input.low && _value <= filter.input.high){
              modified_payload[label] = this.FilterOutput(_value, filter.output);
              break;
            }
          } else if(value ===undefined && filter.input === '_missing'){
            // This filter is applied when the label we are filtering on does not appear in the payload data.
            modified_payload[label] = this.FilterOutput(value, filter.output);
            break;
          }
        }
        if(modified_payload[label] === undefined){
          delete modified_payload[label];
        }
      }

      // Check none of the values are the result of a _drop request.
      var drop = false;
      for(label in modified_payload){
        if(modified_payload[label] === '_drop'){
          drop = true;
        }
      }
      
      // We have a partial payload with modified fields.
      // Now we must copy in all the labels that were not modified.
      if(!drop){
        for(label in payload){
          if(modified_payload[label] === undefined) {
            modified_payload[label] = payload[label];
          }
        }
        samples[subject] = modified_payload;
      }
    }
  }
  this.data.data.outputs[port_out].sample_data = samples;
  this.setAdjacentInputSamples();
};

FlowObjectMapValues.prototype.FilterOutput = function(input_payload, filter_output){
  'use strict';
  if(filter_output === '_drop'){
    return '_drop';  // We filter for this later and remove the entry if found.
  } else if(filter_output === '_forward') {
    return input_payload;
  } else if(typeof(filter_output) === 'object'){
    return 'TODO';
  } else {
    return filter_output;
  }
};



function FlowObjectMapLabels(paper, sidebar, shareBetweenShapes, shape, backend_data){
  'use strict';
  console.log("FlowObjectMapLabels(", paper, sidebar, shareBetweenShapes, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes);
  this.data = { object_name: 'Map labels',
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
                      sample_data: {}
                      }
                    }}};
  if(paper){
    shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, 1, 1, this.data.shape.color);
    this.setShape(shape);
    this.setup(backend_data);

    if(backend_data.data !== undefined){
      // TODO handle more than one label.
      this.data.data.inputs[0].peramiters.else = {updater: "ha-general-attribute",
        description: "When no matching label."};
      var else_found;
      for(var key in backend_data.data.inputs.default.rules){
        var action = backend_data.data.inputs.default.rules[key].action;
        var match = backend_data.data.inputs.default.rules[key].match;
        var value = backend_data.data.inputs.default.rules[key].value;
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


function FlowObjectTestData(paper, sidebar, shareBetweenShapes, shape, backend_data){
  'use strict';
  console.log("FlowObjectTestData");

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes);
  this.data = { object_name: 'Test data',
                description: 'Generate some fake data for testing this UI.',
                shape: {
                  width: 150,
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
                      sample_data: {
                        'test/path/1': { '_subject': 'test/path/1', '_label1': 'string 1', '_label2': 'true', 'label3': 44},
                        'test/path/2': { '_subject': 'test/path/2', '_label1': 'String 2', '_label2': 'false', 'label3': 0},
                        'test/some_other_path': { '_subject': 'test/some_other_path', '_label2': 'false', 'label3': 1},
                        }
                      } } }
              };
  if(paper){
    shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, 0, 1, this.data.shape.color);
    this.setShape(shape);
    this.setup(backend_data);
  }
};

inheritsFrom(FlowObjectTestData, FlowObject);

FlowObjectTestData.prototype.displaySideBar = function(){
  'use strict';
  this.data.data.outputs[0].sample_data = JSON.parse(this.data.data.general.test_data.value);

  this.$super.displaySideBar.call(this);
};


function FlowObjectCombineData(paper, sidebar, shareBetweenShapes, shape, backend_data){
  'use strict';
  console.log('FlowObjectCombineData(', paper, sidebar, shareBetweenShapes, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes);
  this.data = { object_name: 'Combine data',
                description: 'Combine data sharing specified label from multiple data payloads.',
                shape: {
                  width: 150,
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
                      sample_data: {}
                    }
                }
              }
	};
  if(paper){
    shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, 1, 1, this.data.shape.color);
    this.setShape(shape);
    this.setup(backend_data);

    if(backend_data.data !== undefined){
      this.data.data.inputs[0].peramiters.primary_key.value = backend_data.data.inputs.default.primary_key_label
    }
  }
};

inheritsFrom(FlowObjectCombineData, FlowObject);



function FlowObjectAddData(paper, sidebar, shareBetweenShapes, shape, backend_data){
  'use strict';
  console.log('FlowObjectAddData(', paper, sidebar, shareBetweenShapes, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes);
  this.data = { object_name: 'Add data',
                description: 'Add data from multiple data payloads.',
                shape: {
                  width: 150,
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
                      sample_data: {}
                    }
                }
              }
	};
  if(paper){
    shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, 1, 1, this.data.shape.color);
    this.setShape(shape);
    this.setup(backend_data);

    if(backend_data.data !== undefined){
      this.data.data.inputs[0].peramiters.primary_key.value = backend_data.data.inputs.default.primary_key_label
    }
  }
};

inheritsFrom(FlowObjectAddData, FlowObject);




function FlowObjectReadFile(paper, sidebar, shareBetweenShapes, shape, backend_data){
  'use strict';
  console.log('FlowObjectReadFile(', paper, sidebar, shareBetweenShapes, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes);
  this.data = { object_name: 'Read file',
                description: 'Read data from a file on disk.',
                shape: {
                  width: 150,
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
                      sample_data: {}
                    }
                }
              }
	};
  if(paper){
    shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, 0, 1, this.data.shape.color);
    this.setShape(shape);
    this.setup(backend_data);

		if(backend_data.data !== undefined){
      this.data.data.general.filename.value = backend_data.data.general.filename;
		}
  }
};

inheritsFrom(FlowObjectReadFile, FlowObject);




function FlowObjectAddTime(paper, sidebar, shareBetweenShapes, shape, backend_data){
  'use strict';
  console.log('FlowObjectAddTime(', paper, sidebar, shareBetweenShapes, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes);
  this.data = { object_name: 'Add time',
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
                      sample_data: {} 
                    },
                  },
                outputs: {
                    0: {
                      description: 'Default output',
                      sample_data: {}
                    }
                }
              }
	};
  if(paper){
    shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, 1, 1, this.data.shape.color);
    this.setShape(shape);
    this.setup(backend_data);

  }
};

inheritsFrom(FlowObjectAddTime, FlowObject);


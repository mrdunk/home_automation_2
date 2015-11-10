/*global PORT_WIDTH*/
/*global PORT_HEIGHT*/

var FlowObject = function(paper, sidebar, shareBetweenShapes, shape){
  'use strict';
  console.log('FlowObject');

  this.data = {object_name: 'FlowObject',
               data: {outputs: {}, inputs: {}}};
  this.paper = paper;
  this.sidebar = sidebar;
  this.shareBetweenShapes = shareBetweenShapes;
  this.shape = shape || paper.rect(0, 0, 30, 30, 5);
  this.shape.data('parent', this);
  this.shape.drag(this.onmove, this.onstart, this.onend);
  this.shape.mouseover(this.onmouseover);
  this.shape.mouseout(this.onmouseout);
  this.shape.mouseup(this.onmouseup);
  this.shareBetweenShapes.unique_id++;
  this.unique_id = this.shareBetweenShapes.unique_id;
};

FlowObject.prototype.setup = function(){
  'use strict';
  for(var port_out in this.data.data.outputs){
    this.data.data.outputs[port_out].path = {};
    this.data.data.outputs[port_out].links = [];
  }
  for(var port_in in this.data.data.inputs){
    this.data.data.inputs[port_in].path = {};
    this.data.data.inputs[port_in].links = [];
    this.FilterInputToOutput(port_in);
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
  contents = contents || this.data;
  this.shape.setContents(contents);
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
  this.shape[0].setBoxPosition(x, y);
};

FlowObject.prototype.select = function(){
  'use strict';
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
  // TODO: Move this formating into xtags.js
  var header = this.sidebar.getElementsByClassName('sidebar-header')[0];
  if(this.data.data === undefined || this.data.data.general === undefined || this.data.data.general.instance_name === undefined){
    header.getElementsByClassName('text')[0].textContent = this.data.object_name;
    header.getElementsByClassName('object-color')[0].style.height = '1em';
  } else {
    header.getElementsByClassName('text')[0].innerHTML = '';
    var h1 = document.createElement('div');
    var h2 = document.createElement('div');
    h1.innerHTML = this.data.object_name;
    h2.innerHTML = this.data.data.general.instance_name.value;
    header.getElementsByClassName('text')[0].appendChild(h1);
    header.getElementsByClassName('text')[0].appendChild(h2);
    header.getElementsByClassName('object-color')[0].style.height = '2em';
  }
  header.getElementsByClassName('object-color')[0].style.background = this.getColor();

  // Content
  var content = this.sidebar.getElementsByClassName('sidebar-content')[0];
  content.innerHTML = "";

  var list = document.createElement("dl");

  for (var key in this.data.data){
    var list_description = document.createElement("dt");
    var list_content = document.createElement("dd");

    if(key === 'general'){
      list_description.innerHTML = 'General settings:';
    } else if(key === 'inputs'){
      list_description.innerHTML = 'Inputs:';
    } else if(key === 'outputs'){
      list_description.innerHTML = 'Outputs:';
    }
    list.appendChild(list_description);

    for (var inner_key in this.data.data[key]){
      if(key === 'inputs'){
        var input_attribute = document.createElement('ha-input-attribute');
        input_attribute.populate(this.data.data.inputs[inner_key]);
        list_content.appendChild(input_attribute);
      } else if(key === 'outputs'){
        var output_attribute = document.createElement('ha-output-attribute');
        output_attribute.populate(this.data.data.outputs[inner_key]);
        list_content.appendChild(output_attribute);
      } else if(key === 'general'){
        var general_attribute = document.createElement('ha-general-attribute');
        general_attribute.populate(inner_key, this.data.data.general[inner_key], this);
        list_content.appendChild(general_attribute);
      }
    }
    list.appendChild(list_content);
  }

  content.appendChild(list);
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

  if(this.id === this.data('myset')[0].id){
    this.setBoxPosition(dx + this.start_move_x, dy + this.start_move_y);
  } else if(this.data('parent').shareBetweenShapes.dragging){
    var path = this.data('parent').shareBetweenShapes.dragging.arrow.attr('path');
    path[1][1] = path[0][1] + dx;
    path[1][2] = path[0][2] + dy;
    if(Math.abs(path[0][1] - path[1][1]) > 10 || Math.abs(path[0][2] - path[1][2]) > 10){
      this.data('parent').shareBetweenShapes.dragging.arrow.attr('path', path);
    }
  }
};

FlowObject.prototype.onstart = function(){
  'use strict';
  console.log('FlowObject.onstart()', this, this.data('parent'));
  
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
  console.log('FlowObject.onend()');
  this.data('myset').animate({"fill-opacity": 1}, 500);
  
  if(this.data('parent').shareBetweenShapes.dragging){
    this.data('parent').shareBetweenShapes.dragging.arrow.remove();  
    delete this.data('parent').shareBetweenShapes.dragging;

    if(this.data('parent').shareBetweenShapes.linked){
      this.data('parent').linkOutToIn(this.data('parent').shareBetweenShapes.linked.origin, this.data('parent').shareBetweenShapes.linked.desination);
      delete this.data('parent').shareBetweenShapes.linked;
    }
  }
};

FlowObject.prototype.linkOutToIn = function(shape_out, shape_in){
  'use strict';
  console.log('linked!');
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
  console.log("~~~~", input_port_id, this.data.data.outputs[port_out.number].path);
  if(this.data.data.outputs[port_out.number].path[input_port_id] !== undefined){
    console.log('LOOP DETECTED!', input_port_id);
    return;
  }


  this.data.data.outputs[port_out.number].links.push({box_object: shape_in.data('parent'), input_port: port_in.number});
  shape_in.data('parent').data.data.inputs[port_in.number].links.push({box_object: shape_out.data('parent'), output_port: port_out.number});

  this.shape.setOutputLinks(this.data.data.outputs);

  this.setAdjacentInputSamples(port_out.number, shape_in.data('parent'), port_in.number);
};

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

var inheritsFrom = function (child, parent) {
  'use strict';
    child.prototype = Object.create(parent.prototype);
};



var FlowObjectMqttSubscribe = function(paper, sidebar, shareBetweenShapes, shape){
  'use strict';
  console.log("FlowObjectMqttSubscribe");

  shape = shape || paper.box(0, 0, 150, 50, 0, 1, 'seagreen');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes, shape);
  this.data = { object_name: 'MQTT Subscription',
                description: 'Monitor MQTT for a specific topic.',
                data: {
                  general: {
                    instance_name: { 
                      description: 'Name',
                      value: 'Object_' + shareBetweenShapes.unique_id },
                    subscribed_topic: {
                      description: 'MQTT topic subscription',
                      value: 'homeautomation/#'
                    }},
                  inputs: {},
                  outputs: {
                    0: {
                      description: 'Default output',
                      value: 'default',
                      sample_data: {}
                      } } }
              };
  this.shape.setContents(this.data);
  this.setup();
};

inheritsFrom(FlowObjectMqttSubscribe, FlowObject);



var FlowObjectMqttPublish = function(paper, sidebar, shareBetweenShapes, shape){
  'use strict';
  console.log("FlowObjectMqttPublish");

  shape = shape || paper.box(0, 0, 150, 50, 1, 0, 'seagreen');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes, shape);
  this.data = { object_name: 'MQTT Publish',
                description: 'Publish MQTT a message for a specific topic.',
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      value: 'Object_' + shareBetweenShapes.unique_id },
                    publish_topic: {
                      description: 'MQTT topic to Publish to',
                      value: 'homeautomation/test' },
                    payload_passthrough: {
                      description: 'Use Input payload as Output.',
                      value: true,
                      hide: ['payload_custom']
                    },
                    payload_custom: {
                      description: 'Custom string to send as payload.',
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
  this.shape.setContents(this.data);
  this.setup();
};

inheritsFrom(FlowObjectMqttPublish, FlowObject);



var FlowObjectTimer = function(paper, sidebar, shareBetweenShapes, shape){
  'use strict';
  console.log("FlowObjectTimer");

  shape = shape || paper.box(0, 0, 100, 50, 3, 1, 'coral');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes, shape);
  this.data = { object_name: 'Timer',
                description: 'Trigger output after a set delay.',
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      value: 'Object_' + shareBetweenShapes.unique_id },
                    period: {
                      description: 'Time between output trigger. (seconds)',
                      value: '10'
                    },
                    run_at_start: {
                      description: 'Timer running at startup?',
                      value: true,
                      type: 'bool'
                    },
                    repeated: {
                      description: 'Restart automatically after triggering?',
                      value: true,
                      type: 'bool'
                    }},
                  inputs: {
                    0: {
                      description: 'Start',
                      tag: 'start',
                      sample_data: {},
                      trigger_success: [] },
                    2: {
                      description: 'Stop',
                      tag: 'stop',
                      sample_data: {},
                      trigger_success: [] },
                    1: {
                      description: 'Reset',
                      tag: 'reset',
                      sample_data: {},
                      trigger_success: [] }},
                  outputs: {
                    0: {
                      description: 'Default output',
                      tag: 'default',
                      sample_data: {},
                      output_values: {
                        passthrough: false,
                        bool: true,
                        custom: '' }
                      } } }
              };
  this.shape.setContents(this.data);
  this.setup();
};

inheritsFrom(FlowObjectTimer, FlowObject);


var FlowObjectMapValues = function(paper, sidebar, shareBetweenShapes, shape){
  'use strict';
  console.log("FlowObjectMapValues");

  shape = shape || paper.box(0, 0, 75, 50, 1, 1, 'crimson');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes, shape);
  this.data = { object_name: 'Filter values',
                description: 'Filter or modify input variables to different output.',
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      value: 'Object_' + shareBetweenShapes.unique_id
                    },
                    block_labels: {
                      description: 'Remove other labels from the data.',
                      value: true
                    },
                    transitions: {
                      description: 'Map Input ranges to desired Output.',
                      values: {} },
                    },
                  inputs: {
                    0: {
                      description: 'Input 1',
                      tag: 'input1',
                      sample_data: {}
                      },
                    },
                  outputs: {
                    0: {
                      description: 'Default output',
                      tag: 'default',
                      sample_data: {}
                      }
                    }}};
  this.shape.setContents(this.data);
  this.setup();
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
  console.log('FlowObjectMapValues.FilterInputToOutput(', port_in, ')');
  
  // Set the output port as having sourced data from the input.
  var this_port_id = this.data.data.general.instance_name.value + '_in' + port_in;
  this.data.data.outputs[0].path_source = this_port_id;

  // Copy the Input path to the Output.
  for(var input_port_id in this.data.data.inputs[0].path){
    this.data.data.outputs[0].path[input_port_id] = true;
  }
  this.data.data.outputs[0].path[this_port_id] = true;

  // Copy sample data from Input to Output, applying filters.
  var block_labels = stringToBoolean(this.data.data.general.block_labels.value);
  var filters = this.data.data.general.transitions.values;

  var samples = {};
  for(var sender in this.data.data.inputs[port_in].sample_data){
    for(var subject in this.data.data.inputs[port_in].sample_data[sender]){
      var payload = this.data.data.inputs[port_in].sample_data[sender][subject];
      var modified_payload = {};
      
      // Iterate through filters. There can be one for each label.
      // TODO: Allow configuration of more than one label.
      for(var label in filters){
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
      var drop;
      for(var label in modified_payload){
        if(modified_payload[label] === '_drop'){
          drop = true;
        }
      }

      // We have a partial payload with modified fields.
      // Now we must copy in all the labels that were not modified.
      if(!drop){
        for(var label in payload){
          console.log('£££', label, modified_payload[label], payload[label]);
          if(modified_payload[label] === undefined) {
            console.log('*');
            modified_payload[label] = payload[label];
          }
        }

        samples[subject] = modified_payload;
      }
    }
  }
  this.data.data.outputs[0].sample_data = samples;
  this.setAdjacentInputSamples();
};

FlowObjectMapValues.prototype.FilterOutput = function(input_payload, filter_output){
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

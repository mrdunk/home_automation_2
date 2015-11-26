/*global PORT_WIDTH*/
/*global PORT_HEIGHT*/

INPUT_PORT = { description: 'Trigger label', value: '_any', updater: 'ha-general-attribute' };

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
  this.sidebar.setHeader(this.data.object_name, this.data.data.general.instance_name.value, this.getColor());

  // Content
  var flowobject_data = document.createElement('ha-flowobject-data');
  flowobject_data.populate(this.data.data, this);
  var content = this.sidebar.getElementsByClassName('sidebar-content')[0];
  content.innerHTML = "";
  content.appendChild(flowobject_data);
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
    var pos2 = {x: path[0][1] + dx, y: path[0][2] + dy};
    this.data('parent').shareBetweenShapes.dragging.arrow.dragArrow(pos2);
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
                      updater: 'ha-general-attribute',
                      value: 'Object_' + shareBetweenShapes.unique_id },
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
                      updater: 'ha-general-attribute',
                      value: 'Object_' + shareBetweenShapes.unique_id },
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
                      updater: 'ha-general-attribute',
                      value: 'Object_' + shareBetweenShapes.unique_id },
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
                    2: {
                      description: 'Stop',
                      peramiters:{
                        trigger_label: INPUT_PORT,
                        trigger_value: INPUT_PORT
                      },
                      sample_data: {},
                      },
                    1: {
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
                      updater: 'ha-general-attribute',
                      value: 'Object_' + shareBetweenShapes.unique_id },
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
  console.log('FlowObjectMapValues.FilterInputToOutput(', port_in, ')', this.data.data);
  
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


var FlowObjectTestData = function(paper, sidebar, shareBetweenShapes, shape){
  'use strict';
  console.log("FlowObjectTestData");

  shape = shape || paper.box(0, 0, 150, 50, 0, 1, 'gold');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes, shape);
  this.data = { object_name: 'Test data',
                description: 'Generate some fake data for testing this UI.',
                data: {
                  general: {
                    instance_name: { 
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      value: 'Object_' + shareBetweenShapes.unique_id }
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
  this.shape.setContents(this.data);
  this.setup();
};

inheritsFrom(FlowObjectTestData, FlowObject);


var FlowObjectCombineData = function(paper, sidebar, shareBetweenShapes, shape){
  'use strict';
  console.log("FlowObjectCombineData");

  shape = shape || paper.box(0, 0, 150, 50, 2, 1, 'crimson');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes, shape);
  this.data = { object_name: 'Combine data',
                description: 'Combine data from multiple data payloads.',
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      value: 'Object_' + shareBetweenShapes.unique_id }
                  },
                  inputs: {
                    0: {
                      description: 'Default input',
                      sample_data: {} },
                    1: {
                      description: 'Reset',
                      peramiters:{
                        trigger_label: INPUT_PORT,
                        trigger_value: INPUT_PORT },
                      sample_data: {}
                      }
                    },
                  outputs: {
                    0: {
                      description: 'Default output',
                      sample_data: {}
                    }
                  }
                }
	}

  this.shape.setContents(this.data);
  this.setup();
};

inheritsFrom(FlowObjectCombineData, FlowObject);


var FlowObject = function(paper, sidebar, shareBetweenShapes, shape){
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
}

FlowObject.prototype.replaceShape = function(newShape){
  var pos = this.getBoxPosition();
  this.shape.remove();
  this.shape = newShape;

  this.shape.drag(this.onmove, this.onstart, this.onend);
  this.setBoxPosition(pos.x, pos.y);
}

FlowObject.prototype.setContents = function(contents){
  contents = contents || this.data;
  this.shape.setContents(contents);
}

FlowObject.prototype.setInputs = function(input_count){
  this.shape.setInputs(input_count);
  this.shape.drag(this.onmove, this.onstart, this.onend);
}

FlowObject.prototype.setOutputs = function(output_count){
  this.shape.setOutputs(output_count);
  this.shape.drag(this.onmove, this.onstart, this.onend);
}

FlowObject.prototype.getBoxPosition = function(){
  return this.shape[0].getBoxPosition();
}

FlowObject.prototype.setBoxPosition = function(x, y){
  this.shape[0].setBoxPosition(x, y);
}

FlowObject.prototype.select = function(){
  if(this.shareBetweenShapes.selected){
    this.shareBetweenShapes.selected.shape.setHighlight(false);
  }
  this.shape.setHighlight(true);
  this.shareBetweenShapes.selected = this;

  this.displaySideBar();
}

FlowObject.prototype.displaySideBar = function(){
  console.log('FlowObject.displaySideBar()');

  // Header
  var header = this.sidebar.getElementsByClassName('sidebar-header')[0];
  if(this.data.data === undefined || this.data.data.general === undefined || this.data.data.general.instance_name === undefined){
    header.getElementsByClassName('text')[0].textContent = this.data.object_name;
    header.getElementsByClassName('object-color')[0].style.height = '1em';
  } else {
    header.getElementsByClassName('text')[0].innerHTML = this.data.object_name + '<br/>' + this.data.data.general.instance_name.value;
    header.getElementsByClassName('object-color')[0].style.height = '2em';
  }
  header.getElementsByClassName('object-color')[0].style.background = this.getColor();

  // Content
  function callback(){
    console.log('callback', this);
    this.data.value = this.input_context.value;
    this.outer_context.displaySideBar();
    this.outer_context.setContents();
  }
  function createUpdateField(context, name, data){
    var input = document.createElement("input");
    input.value = data.value;
    input.name = name;
    input.onchange = callback.bind({outer_context: context, input_context: input, data: data});
    return input;
  }


  var content = this.sidebar.getElementsByClassName('sidebar-content')[0];
  content.innerHTML = "";

  var outer_list = document.createElement("dl");
  var outer_description;
  var outer_content;

  for (var key in this.data.data){
    var outer_description = document.createElement("dt");
    var outer_content = document.createElement("dd");

    if(key === 'general'){
      outer_description.innerHTML = 'General settings:';
    } else if(key === 'inputs'){
      outer_description.innerHTML = '<br/>Inputs:';
    } else if(key === 'outputs'){
      outer_description.innerHTML = '<br/>Outputs:';
    }
    outer_list.appendChild(outer_description);

    for (var inner_key in this.data.data[key]){
      if(key === 'inputs'){
        var input_attribute = document.createElement('ha-input-attribute');
        input_attribute.populate(this.data.data.inputs[inner_key]);
        outer_list.appendChild(input_attribute);
      } else if(key === 'general'){
        var general_attribute = document.createElement('ha-general-attribute');
        general_attribute.populate(inner_key, this.data.data.general[inner_key]);
        outer_list.appendChild(general_attribute);
      } else {
        outer_list.appendChild(createUpdateField(this, inner_key, this.data.data[key][inner_key]));
      }
    }
    outer_list.appendChild(outer_content);
  }

  content.appendChild(outer_list);
}

FlowObject.prototype.onmouseover = function(){
  if(this.data('parent').shareBetweenShapes.dragging){
    var clicked_shape = this.data('parent').mapShapeToPort(this);
    if(clicked_shape.type === 'inputs'){
      console.log('FlowObject.onmouseover', this, this.data('parent').shareBetweenShapes.dragging);
      this.data('parent').shareBetweenShapes.linked = {origin: this.data('parent').shareBetweenShapes.dragging.origin, desination: this};
      this.animate({"fill-opacity": .2}, 500);
    }
  }
}

FlowObject.prototype.onmouseout = function(){
  if(this.data('parent').shareBetweenShapes.dragging && this.id !== this.data('parent').shareBetweenShapes.dragging.origin.id){
    console.log('FlowObject.onmouseout', this, this.data('myset'));
    this.animate({"fill-opacity": 1}, 500);
    delete this.data('parent').shareBetweenShapes.linked;
  }
}

FlowObject.prototype.onmouseup = function(){
  this.animate({"fill-opacity": 1}, 500);
}

FlowObject.prototype.onmove = function(dx, dy){
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
}

FlowObject.prototype.onstart = function(mouseEvent){
  console.log('FlowObject.onstart()', this, this.data('parent'));
  
  this.data('parent').select();
  this.animate({"fill-opacity": .2}, 500);

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
}

FlowObject.prototype.onend = function(){
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
}

FlowObject.prototype.linkOutToIn = function(shape_out, shape_in){
  console.log('linked!');
  var port_out = this.mapShapeToPort(shape_out);
  var port_in = shape_in.data('parent').mapShapeToPort(shape_in);
  console.log(port_out, port_in);
  if(this.data.data.outputs[port_out.number].links === undefined){
    this.data.data.outputs[port_out.number].links = [];
  }
  if(shape_in.data('parent').data.data.inputs[port_in.number].links === undefined){
    shape_in.data('parent').data.data.inputs[port_in.number].links = [];
  }
  for(var i = 0; i < this.data.data.outputs[port_out.number].links.length; i++){
    if(this.data.data.outputs[port_out.number].links[i].box_object === shape_in.data('parent') && 
        this.data.data.outputs[port_out.number].links[i].input_port === port_in.number){
      console.log('DUPLICATE LINK');
      return;
    }
  }
  this.data.data.outputs[port_out.number].links.push({box_object: shape_in.data('parent'), input_port: port_in.number});
  shape_in.data('parent').data.data.inputs[port_in.number].links.push({box_object: shape_out.data('parent'), output_port: port_out.number});

  this.shape.setOutputLinks(this.data.data.outputs);
}

FlowObject.prototype.mapShapeToPort = function(shape){
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
  console.log('FlowObject.mapShapeToPort', type, number, value);
  return {type: type, number: number, value:value};
}

FlowObject.prototype.setRadius = function(radius){
  this.shape.attr({'r': radius});
}

FlowObject.prototype.setColor = function(color){
  this.shape.attr("fill", color);
  this.shape.attr("stroke", "#000");
}

FlowObject.prototype.getColor = function(){
  return this.shape[0].attr("fill");
}



var inheritsFrom = function (child, parent) {
    child.prototype = Object.create(parent.prototype);
};



var FlowObjectMqttSubscribe = function(paper, sidebar, shareBetweenShapes, shape){
  console.log("FlowObjectMqttSubscribe");

  var shape = paper.box(0, 0, 150, 50, 0, 1, 'seagreen');

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
                      value: 'default'} } }
              }
  this.shape.setContents(this.data);
}

inheritsFrom(FlowObjectMqttSubscribe, FlowObject);



var FlowObjectMqttPublish = function(paper, sidebar, shareBetweenShapes, shape){
  console.log("FlowObjectMqttPublish");

  var shape = paper.box(0, 0, 150, 50, 1, 0, 'seagreen');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes, shape);
  this.data = { object_name: 'MQTT Publish',
                description: 'Publish MQTT a message for a specific topic.',
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      value: 'Object_' + shareBetweenShapes.unique_id },
                    subscribed_topic: {
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
                      trigger_success: [] }},
                  outputs: {}}
              }
  this.shape.setContents(this.data);
}

inheritsFrom(FlowObjectMqttPublish, FlowObject);



var FlowObjectTimer = function(paper, sidebar, shareBetweenShapes, shape){
  console.log("FlowObjectTimer");

  var shape = paper.box(0, 0, 100, 50, 3, 1, 'coral');

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
                      description: 'Run continually or stop after triggering?',
                      value: true,
                      type: 'bool'
                    }},
                  inputs: {
                    0: {
                      description: 'Start',
                      tag: 'start',
                      trigger_success: [] },
                    2: {
                      description: 'Stop',
                      tag: 'stop',
                      trigger_success: [] },
                    1: {
                      description: 'Reset',
                      tag: 'reset',
                      trigger_success: [] }},
                  outputs: {
                    0: {
                      description: 'Default output',
                      tag: 'default',
                      output_values: {
                        passthrough: false,
                        bool: true,
                        custom: '' }
                      } } }
              }
  this.shape.setContents(this.data);
}

inheritsFrom(FlowObjectTimer, FlowObject);



var FlowObjectAnd = function(paper, sidebar, shareBetweenShapes, shape){
  console.log("FlowObjectAnd");

  var shape = paper.box(0, 0, 100, 50, 4, 1, 'gold');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes, shape);
  this.data = { object_name: 'Logical AND',
                description: 'Trigger output only if both inputs evaluate True.',
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      value: 'Object_' + shareBetweenShapes.unique_id } ,
                    },
                  inputs: {
                    0: {
                      description: 'Input 1',
                      tag: 'input1',
                      type: 'boolean',
                      default_value: false },
                    1: {
                      description: 'Input 2',
                      tag: 'input2',
                      type: 'boolean',
                      default_value: false },
                    2: {
                      description: 'Reset',
                      tag: 'reset',
                      type: 'boolean' },
                    3: {
                      description: 'Calcuate now',
                      tag: 'calculate',
                      type: 'boolean' },
                    },
                  outputs: {
                    0: {
                      description: 'Default output',
                      tag: 'default',
                      type: 'boolean',
                      }}}}
  this.shape.setContents(this.data);
}

inheritsFrom(FlowObjectAnd, FlowObject);



var FlowObjectMapValues = function(paper, sidebar, shareBetweenShapes, shape){
  console.log("FlowObjectMapValues");

  var shape = paper.box(0, 0, 75, 50, 1, 1, 'crimson');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes, shape);
  this.data = { object_name: 'Map values',
                description: 'Remap input variables to different output.',
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      value: 'Object_' + shareBetweenShapes.unique_id },
                    transitions: {
                      description: 'Map Input ranges to desired Output.',
                      value: [] },
                    },
                  inputs: {
                    0: {
                      description: 'Input 1',
                      tag: 'input1', 
                      type: ['boolean', 'string', 'number'],
                      default_value: false },
                    },
                  outputs: {
                    0: {
                      description: 'Default output',
                      tag: 'default',
                      type: 'boolean',
                      }}}}
  this.shape.setContents(this.data);

  this.displayTransitions();
}

inheritsFrom(FlowObjectMapValues, FlowObject);

FlowObjectMapValues.prototype.displayTransitions = function(){
  var content = this.sidebar.getElementsByClassName('sidebar-content')[0];

  var transition = document.createElement('ha-transitions');
  transition.populate(this.data.data.general.transitions);
  content.appendChild(transition);
}


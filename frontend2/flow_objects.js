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
      outer_description.innerHTML = 'Inputs:';
    } else if(key === 'outputs'){
      outer_description.innerHTML = 'Outputs:';
    }
    outer_list.appendChild(outer_description);

    var inner_list = document.createElement("dl");
    for (var inner_key in this.data.data[key]){
      var inner_description = document.createElement("dt");
      var inner_content = document.createElement("dd");

      inner_description.innerHTML = this.data.data[key][inner_key].description
      inner_list.appendChild(inner_description);
      
      inner_content.appendChild(createUpdateField(this, inner_key, this.data.data[key][inner_key]));
      inner_list.appendChild(inner_content);

      outer_content.appendChild(inner_list);
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
  
  this.data('parent').displaySideBar();
  this.animate({"fill-opacity": .2}, 500);

  var clicked_shape = this.data('parent').mapShapeToPort(this);
  if(clicked_shape.type === 'parent'){
    this.start_move_x = this.attr("x");
    this.start_move_y = this.attr("y");
  } else if(clicked_shape.type === 'inputs'){
  } else if(clicked_shape.type === 'outputs'){
    var pos1 = this.getShapePosition();
    pos1.x = pos1.x + PORT_SIZE /2;
    pos1.y = pos1.y + PORT_SIZE /2;
    var pos2 = {x: pos1.x + 5, y: pos1.y};
    this.data('parent').shareBetweenShapes.dragging = {arrow: this.paper.arrow(pos1, pos2, 'black'), origin: this};
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
                      value: 'Object_' + shareBetweenShapes.unique_id } },
                  inputs: {
                    0: {
                      description: 'MQTT topic',
                      value: ''} },
                  outputs: {
                    0: {
                      description: 'Default output',
                      value: 'default'} } }
              }
  this.shape.setContents(this.data);
}

inheritsFrom(FlowObjectMqttSubscribe, FlowObject);



var FlowObjectTimer = function(paper, sidebar, shareBetweenShapes, shape){
  console.log("FlowObjectTimer");

  var shape = paper.box(0, 0, 150, 50, 3, 1, 'coral');

  FlowObject.prototype.constructor.call(this, paper, sidebar, shareBetweenShapes, shape);
  this.data = { object_name: 'Timer',
                description: 'Trigger output after a set delay.',
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      value: 'Object_' + shareBetweenShapes.unique_id } },
                  inputs: {
                    0: {
                      description: 'Delay period',
                      value: 'period'},
                    1: {
                      description: 'Trigger',
                      value: 'trigger' },
                    2: {
                      description: 'Cancel',
                      value: 'cancel' }},
                  outputs: {
                    0: {
                      description: 'Default output',
                      value: 'default'} } }
              }
  this.shape.setContents(this.data);
}

inheritsFrom(FlowObjectTimer, FlowObject);




Raphael.fn.arrow = function (pos1, pos2, color) {
  var path = 'M ' + pos1.x + ' ' + pos1.y + ' L ' + pos2.x + ' ' + pos2.y;
  return this.path(path).attr({stroke: color, fill: "none", 'stroke-width': 3, 'arrow-end': 'classic-wide'});
};


Raphael.fn.box = function(x, y, width, height, input_count, output_count, color){
  var set_main = this.set();
  var shape = this.rect(x, y, width, height, 5);
  shape.x_offset = 0;
  shape.y_offset = 0;
  set_main.push(shape);

  var set_content = this.set();
  shape = this.text(x + 5, y, "Test Text").attr({font: "12px Fontin-Sans, Arial", fill: "#fff", "text-anchor": "start"});
  shape.x_offset = 5;
  shape.y_offset = 8;
  set_content.push(shape);
  set_content.label = 'contents';
  set_main.push(set_content);

  var set_inputs = this.set();
  for(var i = 0; i < input_count; i++){
    shape = this.rect(x - PORT_SIZE, y + PORT_SIZE + (i * PORT_SIZE), PORT_SIZE, PORT_SIZE, 2);
    shape.x_offset = -PORT_SIZE;
    shape.y_offset = PORT_SIZE + (i * PORT_SIZE);
    set_inputs.push(shape);
  }
  set_inputs.label = 'inputs';
  set_main.push(set_inputs);

  var set_outputs = this.set();
  for(var i = 0; i < output_count; i++){
    shape = this.rect(x + width, y + PORT_SIZE + (i * PORT_SIZE), PORT_SIZE, PORT_SIZE, 2);
    shape.x_offset = width;
    shape.y_offset = PORT_SIZE + (i * PORT_SIZE);
    set_outputs.push(shape);
  }
  set_outputs.label = 'outputs';
  set_main.push(set_outputs);

  var set_links = this.set();
  set_links.label = 'links';
  set_main.push(set_links);

  set_main.data('myset', set_main);
  set_main.data('label', 'container');

  set_main.attr({"fill": color, "stroke": "#000"});
  return set_main;
}

Raphael.st.setContents = function(content){
  if(this.type === "set"){
    var pos = this.items[0].getBoxPosition();  // item 0 is the parent shape.
    var x = pos.x;
    var y = pos.y;
    for(var i = 0; i < this.items.length; i++){
      if(this.items[i].label === 'contents'){
        var node;
        while(node = this.items[i].pop()){
          node.remove();
        }
        var shape = this.paper.text(x + 5, y, content.object_name).attr({font: "12px Fontin-Sans, Arial", fill: "black", "text-anchor": "start"});
        shape.x_offset = 5;
        shape.y_offset = 8;
        this.items[i].push(shape);
        shape = this.paper.text(0, 0, content.data.general.instance_name.value).attr({font: "12px Fontin-Sans, Arial", fill: "black", "text-anchor": "start"});
        shape.x_offset = 5;
        shape.y_offset = 22;
        this.items[i].push(shape);
        // For some reason new shapes added to a set do not appear until they are moved.
        setBoxPosition(this.items[i], x, y);
      }
    }
  }
}

Raphael.st.setInputs = function(input_count){
  if(this.type === "set"){
    var pos = this.items[0].getBoxPosition();  // item 0 is the parent shape.
    var x = pos.x;
    var y = pos.y;
    var color = this.items[0].attr('fill');
    for(var i = 0; i < this.items.length; i++){
      if(this.items[i].label === 'inputs'){
        var node;
        while(node = this.items[i].pop()){
          node.remove();
        }
        for(var j = 0; j < input_count; j++){
          var shape = this.paper.rect(x - PORT_SIZE, y + PORT_SIZE + (i * PORT_SIZE), PORT_SIZE, PORT_SIZE, 2);
          shape.x_offset = -PORT_SIZE;
          shape.y_offset = PORT_SIZE + (j * PORT_SIZE);
          shape.attr({"fill": color, "stroke": "#000"});
          this.items[i].push(shape);
        }
        // For some reason new shapes added to a set do not appear until they are moved.
        setBoxPosition(this.items[i], x, y);
      }
    }
  }
}

Raphael.st.setOutputs = function(output_count){
  if(this.type === "set"){
    var pos = this.items[0].getBoxPosition();  // item 0 is the parent shape.
    var x = pos.x;
    var y = pos.y;
    var width = this.items[0].attr('width');
    var color = this.items[0].attr('fill');
    for(var i = 0; i < this.items.length; i++){
      if(this.items[i].label === 'outputs'){
        var node;
        while(node = this.items[i].pop()){
          node.remove();
        }
        for(var j = 0; j < output_count; j++){
          var shape = this.paper.rect(x + width, y + PORT_SIZE + (i * PORT_SIZE), PORT_SIZE, PORT_SIZE, 2);
          shape.x_offset = width;
          shape.y_offset = PORT_SIZE + (j * PORT_SIZE);
          shape.attr({"fill": color, "stroke": "#000"});
          this.items[i].push(shape);
        }
        // For some reason new shapes added to a set do not appear until they are moved.
        setBoxPosition(this.items[i], x, y);
      }
    }
  }
}

Raphael.st.setOutputLinks = function(outputs){
  var links;
  for(var key_types in this.items){
    if(this.items[key_types].label === 'links'){
      links = this.items[key_types];
      var node;
      while(node = links.pop()){
        node.remove();
      }
    }
  }

  for(var key_types in this.items){
    if(this.items[key_types].label === 'outputs'){
      for(var key_shape_output in this.items[key_types].items){
        for(var key_data_output in outputs){
          if(key_shape_output === key_data_output){
            var outgoing_port_shape = this.items[key_types][key_shape_output];
            for(var key_link in outputs[key_data_output].links){
              var incoming_port_index = outputs[key_data_output].links[key_link].input_port;
              var incoming_port_shape = outputs[key_data_output].links[key_link].box_object.shape.getPort('inputs', incoming_port_index);

              var pos1 = outgoing_port_shape.getShapePosition();
              var pos2 = incoming_port_shape.getShapePosition();
              var pos1 = {x: pos1.x + PORT_SIZE /2, y: pos1.y + PORT_SIZE /2};
              var pos2 = {x: pos2.x + PORT_SIZE /2, y: pos2.y + PORT_SIZE /2};
              var shape = this.paper.arrow(pos1, pos2, 'red');
              links.push(shape);
            }
          }
        }
      }
    }
  }
}

Raphael.st.setInputLinks = function(inputs){
  var move_list = {};
  for(var key in inputs){
    if(inputs[key].links){
      for(var i = 0; i < inputs[key].links.length; i++){
        var output_object = inputs[key].links[i].box_object;
        move_list[output_object.unique_id] = output_object;
      }
    }
  }

  console.log(move_list);

  for(var key in move_list){
    console.log(move_list[key]);
    move_list[key].shape.setOutputLinks(move_list[key].data.data.outputs);
  }
}

Raphael.st.getPort = function(type, index){
  for(var key_types in this.items){
    if(this.items[key_types].label === type){
      for(var key_port = 0; key_port < this.items[key_types].length; key_port++){
        if(key_port === index){
          return this.items[key_types][key_port];
        } 
      } 
    }
  } 
}

Raphael.el.getBoxPosition = function(){
  return {x: this.data('myset')[0].attr("x"), y: this.data('myset')[0].attr("y")};
}

Raphael.el.getShapePosition = function(){
  return {x: this.attr("x"), y: this.attr("y")};
}

Raphael.el.setBoxPosition = function(x, y){
  setBoxPosition(this.data('myset'), x, y);
  this.data('myset').setOutputLinks(this.data('parent').data.data.outputs);
  this.data('myset').setInputLinks(this.data('parent').data.data.inputs);
}

var setBoxPosition = function(component, x, y){
  if(component.type === "set"){
    for(var i = 0; i < component.items.length; i++){
      setBoxPosition(component.items[i], x, y);
    }
  } else {
    component.attr({x: x + component.x_offset, y: y + component.y_offset});
  }
}



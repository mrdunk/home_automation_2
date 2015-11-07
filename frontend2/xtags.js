
var buttonTypes = {'alarm':              {'action':'new_object', callback: FlowObjectTimer},
                   'cloud-download':     {'action':'new_object', callback: FlowObjectMqttSubscribe},
                   'cloud-upload':       {'action':'new_object', callback: FlowObjectMqttPublish},
                   'add-circle-outline': {'action':'new_object', callback: FlowObjectAnd},
                   'trending-flat':      {'action':'new_object', callback: FlowObjectMapValues},
                   'content-copy':       {'action':'new_object'},
                   'redo':               {'action':'join'},
                   'settings':           {'action':'edit'}
                  }

xtag.register('ha-control', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-control').innerHTML;
      xtag.innerHTML(this, template);
      this.paper = Raphael('ha-control-paper', '100%', '100%');
      this.header = document.getElementsByTagName('ha-control-heading')[0];
      this.header.setParent(this);
      this.sidebar = document.getElementById('ha-control-sidebar');
      this.shapes = [];
      this.shareBetweenShapes = {unique_id: 0};
    }
  },
  methods: {
    buttonClicked: function(button_settings){
      if(button_settings.action === 'new_object'){
        this.addShape(button_settings);
      }
    },
    addShape: function(object_type){
      var shape;
      console.log(object_type);
      if(object_type.callback){
        shape = new object_type.callback(this.paper, this.sidebar, this.shareBetweenShapes);
      } else {
        shape = new FlowObject(this.paper, this.sidebar, this.shareBetweenShapes, this.paper.box(0, 0, 50, 50, 2, 3, object_type.color));
      }
      shape.setBoxPosition(100,100);

      shape.select();
      this.shapes.push(shape);
    },
  }
});

xtag.register('ha-control-heading', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-control-heading').innerHTML;
      xtag.innerHTML(this, template);
    }
  },
  events: {
    'click:delegate(paper-icon-button)': function(mouseEvent){
      console.log(mouseEvent, this);
      var ha_control_heading;
      for (var i = 0; i < mouseEvent.path.length; i++){
        if(xtag.matchSelector(mouseEvent.path[i], 'ha-control-heading')){
          ha_control_heading = mouseEvent.path[i]
          break;
        }
      }
      if(ha_control_heading === 'undefined'){ return; }

      ha_control_heading.parent.buttonClicked(buttonTypes[this.icon]);
    }
  },
  methods: {
    setParent: function(parent){
      console.log(parent);
      this.parent = parent;
    }
  },
});


xtag.register('ha-input-attribute', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-input-attribute').innerHTML;
      xtag.innerHTML(this, template);
    },
    removed: function(){
      document.removeEventListener('click', this.clickOutside, false);
    }
  },
  events: {
    click: function(mouseEvent){
      console.log(this, mouseEvent, mouseEvent.target.className);
      if(mouseEvent.target.className === 'summary'){
        mouseEvent.path[1].getElementsByClassName('summary')[0].style.display = 'none';
        mouseEvent.path[1].getElementsByClassName('detailed')[0].style.display = 'inline';
        document.addEventListener('click', this.clickOutside, false);
      }
    }
  },
  methods: {
    populate: function(data){
      this.getElementsByClassName('description')[0].innerHTML = data.description;

      var form = this.getElementsByClassName('form')[0];

      var inputs = [[true, ['', '==', '!='], '=='],
                    [false, ['', '==', '!='], ''],
                    ['yes', ['', '==', '!='], '=='],
                    ['no', ['', '==', '!='], ''],
                    [0,  ['', '==', '!=', '>', '<', '>=', '<='], ''],
                    [1, ['', '==', '!=', '>', '<', '>=', '<='], '>=']];
      var summary = document.createElement('div');
      summary.className = 'summary';
      var detailed = document.createElement('div');
      detailed.className = 'detailed';
      detailed.style.display = 'none';
      form.appendChild(summary);
      form.appendChild(detailed);

      for(var i = 0; i < inputs.length; i++){
        var wrapper_detailed = document.createElement('div');
        var select = document.createElement('select');
        for(var j = 0; j < inputs[i][1].length; j++){
          var option = document.createElement("option");
          option.text = inputs[i][1][j];
          if(inputs[i][1][j] === inputs[i][2]){
            option.setAttribute("selected", "selected");
          }
          select.appendChild(option);
        }
        if(inputs[i][2] !== ''){
          summary.innerHTML = summary.innerHTML + inputs[i][2] + ' ' + inputs[i][0] + ', ';
        }
        
        select.type = 'checkbox';
        select.name = inputs[i][0];
        wrapper_detailed.appendChild(select);
        wrapper_detailed.innerHTML = wrapper_detailed.innerHTML + inputs[i][0] + '\t(' + typeof(inputs[i][0]) + ')';

        detailed.appendChild(wrapper_detailed);
      }
      summary.innerHTML = summary.innerHTML.substring(0, summary.innerHTML.length -2);
    },
    clickOutside: function(event){
      console.log('clickOutside');
      var form_found;
      for(var parent in event.path){
        if(event.path[parent].className === 'form'){
          form_found = true;
        }
      }
      if(form_found){
        // not actually outside the form.
        return
      }
      console.log('clickOutside 2');

      var summaries = this.getElementsByClassName('summary');
      for(var i = 0; i < summaries.length; i++){
        summaries[i].style.display = "inline";
      }
      var detaileds = this.getElementsByClassName('detailed');
      for(var i = 0; i < detaileds.length; i++){
        detaileds[i].style.display = "none";
      }

      // TODO. the following doesn't work as we no longer have the correct context.
      // document.removeEventListener('click', this.clickOutside, false);  
    }
  }
});


xtag.register('ha-general-attribute', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-general-attribute').innerHTML;
      xtag.innerHTML(this, template);
    },
  },
  methods: {
    populate: function(name, data, flow_object){
      if(name === 'transitions'){
        var input = document.createElement('ha-transitions');
        input.populate(data);
        this.getElementsByClassName('form')[0].appendChild(input);
      } else if(name === 'subscribed_topic'){
        var input = document.createElement('ha-topic-chooser');
        input.populate(0, '', 'root', Data.mqtt_data);
        this.getElementsByClassName('form')[0].appendChild(input);
      } else if(data.description && data.value){
        this.getElementsByClassName('description')[0].innerHTML = data.description;

        var input = document.createElement("input");
        input.value = data.value;
        input.name = name;
        input.onchange = this.update_callback.bind({element: input, data: data, flow_object: flow_object});

        this.getElementsByClassName('form')[0].appendChild(input);
      }
    },
    update_callback: function(update_event){
      console.log('update_callback', this, update_event);
      this.data.value = this.element.value;

      if(this.data.description === 'Name'){
        // Redraw sidebar and shape.
        this.flow_object.displaySideBar();
        this.flow_object.shape.setContents(this.flow_object.data);
      }
    }
  }
});


xtag.register('ha-transitions', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-transitions').innerHTML;
      xtag.innerHTML(this, template);
    },
  },
  events: {
    'click:delegate(button)': function(mouseEvent){
      console.log(mouseEvent.srcElement.value);
      var transition; 
      for (var i = 0; i < mouseEvent.path.length; i++){
        if(xtag.matchSelector(mouseEvent.path[i], 'ha-transitions')){
          transition = mouseEvent.path[i]
          break;
        }
      }
      if(transition === 'undefined'){ return; }

      if(mouseEvent.srcElement.value === 'add'){
        transition.newRange();
        transition.populate();
      } else {
        transition.data.value.splice(mouseEvent.srcElement.value, 1);
        transition.populate();
      }
    }
  },
  methods: {
    populate: function(data){
      this.data = data || this.data;

      if(this.data.value.length === 0){
        this.prePopulateRange();
      }

      var form = this.getElementsByClassName('transition-form')[0];
      while(form.firstChild){
            form.removeChild(form.firstChild);
      }

      var table = document.createElement('div');
      table.className = 'table-transition';
      form.appendChild(table);
      var control = document.createElement('div');
      var left = document.createElement('div');
      var right = document.createElement('div');
      control.className = 'control-transition';
      left.className = 'input-transition';
      right.className = 'output-transition';
      table.appendChild(control);
      table.appendChild(left);
      table.appendChild(right);
      for(var i = 0; i < this.data.value.length; i++){
        var button = document.createElement('button');
        button.textContent = '-';
        button.value = i;
        control.appendChild(button);
        left.appendChild(this.chooser(this.data.value[i], 'input'));
        right.appendChild(this.chooser(this.data.value[i], 'output'));
      }
      var button = document.createElement('button');
      button.textContent = '+';
      button.value = 'add';
      control.appendChild(button);
    },
    update_callback: function(){
      console.log('update_callback', this);
    },
    newRange: function(){
      var range = {input: true, output: true};
      this.data.value.push(range);
    },
    prePopulateRange: function(){;
      this.data.value.push( {input: true, output: true} );
      this.data.value.push( {input: 'yes', output: true} );
      this.data.value.push( {input: {low: 1, high: 100}, output: true} );
      this.data.value.push( {input: false, output: false} );
      this.data.value.push( {input: 'no', output: false} );
      this.data.value.push( {input: {low: -100, high: 0}, output: false} );
    },
    chooser: function(range, io){
      var container = document.createElement('div');
      var select = document.createElement('select');
      var option = document.createElement("option");
      option.text = 'boolean';
      if(typeof(range[io]) === 'boolean'){
        option.setAttribute("selected", "selected");
      }
      select.appendChild(option);
      option = document.createElement("option");
      option.text = 'string';
      if(typeof(range[io]) === 'string'){
        option.setAttribute("selected", "selected");
      }
      select.appendChild(option);
      option = document.createElement("option");
      option.text = 'number';
      if(typeof(range[io]) === 'object'){
        option.setAttribute("selected", "selected");
      }
      select.appendChild(option);

      var input_bool = document.createElement('select');
      option = document.createElement("option");
      option.text = 'true';
      option.value = true;
      if(typeof(range[io]) === 'boolean'){
        if(range[io]){
          option.setAttribute("selected", "selected");
        }
      }
      input_bool.appendChild(option);
      option = document.createElement("option");
      option.text = 'false';
      option.value = false;
      if(typeof(range[io]) === 'boolean'){
        if(range[io] === false){
          option.setAttribute("selected", "selected");
        }
      }
      input_bool.appendChild(option);

      var input_string = document.createElement('input');
      input_string.type = 'text';
      input_string.value = range[io];

      var input_number = document.createElement('div');
      var input_number_low = document.createElement('input');
      input_number_low.type = 'number';
      if(typeof range[io].low !== 'undefined'){
        input_number_low.value = range[io].low;
      } else {
        input_number_low.value = 0;
      }
      input_number_low.style.width = '4em';
      var input_number_high = document.createElement('input');
      input_number_high.type = 'number';
      if(typeof range[io].high !== 'undefined'){
        input_number_high.value = range[io].high;
      } else {
        input_number_high.value = 100;
      }
      input_number_high.style.width = '4em';
      input_number.appendChild(input_number_low);
      input_number.appendChild(document.createTextNode('to'))
      input_number.appendChild(input_number_high);

      if(select.value !== 'boolean'){
        input_bool.style.display = "none";
      }
      if(select.value !== 'string'){
        input_string.style.display = "none";
      }
      if(select.value !== 'number'){
        input_number.style.display = "none";
      }

      container.appendChild(select);
      container.appendChild(input_bool);
      container.appendChild(input_string);
      container.appendChild(input_number);

      container.addEventListener('change', this.chooser_change.bind({
          data: range, io: io, select: select, input_bool: input_bool, input_string: input_string, input_number: input_number}));
      container.addEventListener('mousedown', this.chooser_change.bind({
          data: range, io: io, select: select, input_bool: input_bool, input_string: input_string, input_number: input_number}));
      return container;
    },
    chooser_change: function(){
      console.log('chooser_change', this);

      // TODO: fix this so it only allows number ranges for the output if there are number ranges for the input.
      if(this.io === 'output'){
        if(typeof(this.data.input) !== 'object'){
          if(this.select.value === 'number'){
            this.select.children[2].removeAttribute("selected");
            this.select.children[1].setAttribute("selected", "selected");
          }
          this.select.children[2].style.display = "none";
        } else{
          this.select.children[2].style.display = "initial";
        }
      }

      if(this.select.value === 'boolean'){
        this.input_bool.style.display = 'inline';
        this.input_string.style.display = 'none';
        this.input_number.style.display = 'none';
        this.data[this.io] = this.input_bool.value == 'true';
      } else if(this.select.value === 'string'){
        this.input_bool.style.display = 'none';
        this.input_string.style.display = 'inline';
        this.input_number.style.display = 'none';
        this.data[this.io] = this.input_string.value;
      } else if(this.select.value === 'number'){
        this.input_bool.style.display = 'none';
        this.input_string.style.display = 'none';
        this.input_number.style.display = 'inline';
        this.data[this.io] = {low: this.input_number.children[0].value, high: this.input_number.children[1].value};
      }

      if(Number(this.input_number.children[0].value) > Number(this.input_number.children[1].value)){
        this.input_number.children[1].value = this.input_number.children[0].value;
      }
    }
  }
});


xtag.register('ha-topic-chooser', {
  lifecycle:{
    created: function(){
    },
  },
  events: {
    click: function(mouseEvent){
      var line;
      for (var i = 0; i < mouseEvent.path.length; i++){
        if(xtag.matchSelector(mouseEvent.path[i], 'ha-topic-chooser')){
          line = mouseEvent.path[i]
          break;
        }
      }
      if(line === 'undefined'){ return; }

      line.colapseAll();
      line.display();
    }
  },
  methods: {
    populate: function(level, prefix, name, data){
      var title = document.createElement('div');
      title.innerHTML = prefix + name;
      this.appendChild(title);
      for(key in data){
        if(typeof(key) === 'string' && key !== 'updated' && typeof(data[key]) === 'object'){
          var new_item = document.createElement('ha-topic-chooser');
          new_item.populate(level +1, prefix + name + '/', key, data[key]);
          //new_item.style.pointerEvents = 'none';
          if(level >= 1) {
            new_item.style.display = 'none';
          }
          this.appendChild(new_item);
        }
      }
    },
    colapseAll: function(){
      console.log("C", this);
      var current = this;
      while(current.parentElement.nodeName === 'HA-TOPIC-CHOOSER'){
        current = current.parentElement;
      }

      var f = function(e, level){
        for(var i = 0; i < e.children.length; i++){
          if(level > 1){
            e.children[i].style.display = 'none';
          }
          f(e.children[i], level +1);
        }
      }
      f(current, 0);
    },
    display: function(){
      console.log(this);
      this.displayPeers();
      for(var i = 0; i < this.children.length; i++){
        console.log("*", this.children[i]);
        this.children[i].style.display = 'block';
        if(this.children[i].nodeName === 'HA-TOPIC-CHOOSER'){
          this.children[i].displayPeers();
        }
        for(var j = 0; j < this.children[i].children.length; j++){
          if(this.children[i].children[j].nodeName !== 'HA-TOPIC-CHOOSER'){
            console.log("**", this.children[i].children[j], this.children[i].children[j].nodeName);
            this.children[i].children[j].style.display = 'block';
          } else {
            //this.children[i].children[j].displayPeers();
          }
        }
      }
    },
    displayPeers: function(){
      console.log("#", this);
      var parent_element = this.parentElement;
      console.log("##", parent_element);
      for(var i = 0; i < parent_element.children.length; i++){
        parent_element.children[i].style.display = 'block';
        for(var j = 0; j < parent_element.children[i].children.length; j++){
          if(parent_element.children[i].children[j].nodeName !== 'HA-TOPIC-CHOOSER'){
            console.log("###", parent_element.children[i].children[j]);
            parent_element.children[i].children[j].style.display = 'block';
          } else {
            parent_element.children[i].children[j].style.display = 'none';
          }
        }
      }
    }
  }
});

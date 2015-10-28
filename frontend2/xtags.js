
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
    populate: function(name, data){
      if(name === 'transitions'){
        var input = document.createElement('ha-transitions');
        input.populate(data);

        this.getElementsByClassName('form')[0].appendChild(input);
      } else if(data.description && data.value){
        this.getElementsByClassName('description')[0].innerHTML = data.description;

        var input = document.createElement("input");
        input.value = data.value;
        input.name = name;
        input.onchange = this.update_callback.bind({element: input, data: data});

        this.getElementsByClassName('form')[0].appendChild(input);
      }
    },
    update_callback: function(){
      console.log('update_callback', this);
      this.data.value = this.element.value;
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
    'click:delegate(paper-icon-button)': function(mouseEvent){
      var transition;
      for (var i = 0; i < mouseEvent.path.length; i++){
        if(xtag.matchSelector(mouseEvent.path[i], 'ha-transitions')){
          transition = mouseEvent.path[i]
          break;
        }
      }
      if(transition === 'undefined'){ return; }
      transition.newRange();
      transition.populate();
    }
  },
  methods: {
    populate: function(data){
      this.data = data || this.data;

      if(this.data.value.length === 0){
        this.newRange();
        this.newRange();
      }

      var form = this.getElementsByClassName('transition-form')[0];
      while(form.firstChild){
            form.removeChild(form.firstChild);
      }

      var table = document.createElement('div');
      table.className = 'table-transition';
      form.appendChild(table);
      var left = document.createElement('div');
      var right = document.createElement('div');
      left.className = 'input-transition';
      right.className = 'output-transition';
      table.appendChild(left);
      table.appendChild(right);
      for(var i = 0; i < this.data.value.length; i++){
        left.appendChild(this.chooser(this.data.value[i], 'input'));
        right.appendChild(this.chooser(this.data.value[i], 'output'));
      }
      var button = document.createElement('paper-icon-button');
      button.icon = 'add-circle-outline';
      form.appendChild(button);
    },
    update_callback: function(){
      console.log('update_callback', this);
    },
    newRange: function(){
      var range = {input: true, output: true};
      this.data.value.push(range);
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
      if(range[io].low){
        input_number_low.value = range[io].low;
      } else {
        input_number_low.value = 0;
      }
      input_number_low.style.width = '4em';
      var input_number_high = document.createElement('input');
      input_number_high.type = 'number';
      if(range[io].high){
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

      if(this.input_number.children[0].value > this.input_number.children[1].value){
        this.input_number.children[1].value = this.input_number.children[0].value;
      }

      console.log(this.data);
    }
  }
});


xtag.register('ha-container', {
  lifecycle:{
    created: function(){
      //console.log("ha-container.created");
      var template = document.getElementById('ha-container').innerHTML;
      xtag.innerHTML(this, template);

      // this.id probably isn't set yet for all except the root node.
      this.address = this.id.substr("ha-container-".length)
      this.name = this.address.split('/')[0]

      this.addIcon(this.name)
    }
  },
  methods: {
    // Add the icon button to an element.
    addIcon: function(type){
      if(type === undefined){
        return
      }

      if(type === "io"){
        this.device_icon = document.createElement("ha-light")
        this.getElementsByClassName("ha-device-icon")[0].appendChild(this.device_icon)
        this.device_icon.id = "ha-light-" + this.address
      } else if(type === "log"){
        this.device_icon = document.createElement("ha-log")
        this.getElementsByClassName("ha-device-icon")[0].appendChild(this.device_icon)
        this.device_icon.id = "ha-log-" + this.address
      }
    },
    // Add a child element to this element.
    // Will add recursive layers of elements to account for the requested child
    // being many layers deeper than the current.
    addChild: function(child_address, child_value){
      //console.log("addChild:", child_address, child_value)
        
      if(child_address !== this.address && child_address.search(this.address) === 0){
        // Since "this" has children, make the button to expand it visible.
        this.getElementsByTagName("ha-button-show-children")[0].style.display = 'block'

        var child_address_diff = child_address.slice(this.address.length +1)

        var immediate_child_name = child_address_diff.split("/")[0]
        var immediate_child_address = this.address + "/" + immediate_child_name
        var immediate_child = this.getChild(immediate_child_address)

        if(immediate_child === undefined){
          immediate_child = document.createElement("ha-container")
          this.getElementsByClassName("ha-container-children")[0].appendChild(immediate_child)

          immediate_child.getElementsByTagName("ha-button-show-children")[0].style.display =
              'none'

          immediate_child.name = immediate_child_name
          immediate_child.address = immediate_child_address
          immediate_child.id = "ha-container-" + immediate_child_address

          var root_name = immediate_child.address.split('/')[0]
          immediate_child.addIcon(root_name)

          if(immediate_child.device_icon){
            immediate_child.device_icon.id = "ha-light-" + immediate_child_address
          }
        }

        immediate_child.addChild(child_address, child_value)

      } else {
        var child_value_parsed = false
        if(child_value.toLowerCase() === "on" || child_value.toLowerCase() === "true" ||
            parseInt(child_value) > 0){
          child_value_parsed = true
        }
        if(this.device_icon){
          this.device_icon.displayed = child_value_parsed
          this.device_icon.tidyParent()
        }
      }
    },
    getChild: function(child_address){
      var children = this.getElementsByClassName("ha-container-children")[0].childNodes
      for(var i = 0; i < children.length; i++){
        if(children[i].address === child_address){
          return children[i]
        }
      }
    }
  },
  events: {
    'click:delegate(ha-button-show-children)': function(){
      // Because this is a delegated function, it runs in the context of button-show-children,
      // therefore we must use the .parentElement.
      var contents = this.parentElement.parentElement.getElementsByClassName("ha-container-children")[0];
      if(this.expanded){
        contents.style.display = "block";
      } else {
        contents.style.display = "none";
      }
    }
  },
  accessors: {
    'name': {
      set: function(value){
        //console.log("accessors:name:set:", value)
        this.getElementsByClassName("ha-container-name")[0].innerHTML = value
        this._name = value
      },
      get: function(){
        return this._name
      }
    }
  }
});

xtag.register('ha-button-show-children', {
  expanded: false,
  lifecycle:{
    created: function(){
      // fired once at the time a component
      // is initially created or parsed
      //console.log("ha-button-show-children.created");
      var template = document.getElementById('ha-button-show-children').content;
      this.appendChild(template.cloneNode(true));
    },
    inserted: function(){
      // fired each time a component
      // is inserted into the DOM
      //console.log("ha-button-show-children.inserted");
    }
  },
  events: {
    'click': function(){
      //console.log("ha-button-show-children.events.click");
      this.expanded = !this.expanded;
      if(this.expanded === false){
        this.getElementsByClassName("ha-button-show-children-show")[0].style.display = "block";
        this.getElementsByClassName("ha-button-show-children-hide")[0].style.display = "none";
      } else {
        this.getElementsByClassName("ha-button-show-children-show")[0].style.display = "none";
        this.getElementsByClassName("ha-button-show-children-hide")[0].style.display = "block";
      }
    }
  }
});

xtag.register('ha-light', {
  on_off: false,
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-light-binary').innerHTML;
      xtag.innerHTML(this, template);
    }
  },
  accessors: {
    'switched': {
      set: function(value){
        //console.log('switched:', value)
        this.displayed = value

        // Now do the same for all children.
        var address = this.id.substr("ha-light-".length)

        var children = document.getElementById("ha-container-" + address).getElementsByClassName("ha-container-children")[0].childNodes
        for(var i = 0; i < children.length; i++){
            document.getElementById("ha-light-" + children[i].address).switched = value
        }
      },
      get: function(){
        return this.on_off
      }
    },
    'displayed': {
      set: function(value){
        this.on_off = value;
        if (this.on_off) { 
          this.style.color = "#ffb";
        } else {
          this.style.color = "#bbb";
        }
      }
    }
  },
  methods: {
    // Make sure Parent icons are displayed correctly.
    tidyParent: function(){
      var address = this.id.substr("ha-light-".length)
      var parent_address = address.substr(0, address.lastIndexOf("/"))
      if(parent_address ===""){
        return
      }

      var at_least_one_peer_on = false
      var peers = document.getElementById("ha-container-" + parent_address).getElementsByClassName("ha-container-children")[0].childNodes
      for(var i = 0; i < peers.length; i++){
        if(document.getElementById("ha-light-" + peers[i].address).switched === true){
          at_least_one_peer_on = true
        }
      }
      document.getElementById("ha-light-" + parent_address).displayed = at_least_one_peer_on

      while(parent_address.length){
        document.getElementById("ha-light-" + parent_address).tidyParent()
        parent_address = parent_address.substr(0, parent_address.lastIndexOf("/"))
      }
    }
  },
  events: {
    'click': function(){
      var send_data;
      if(this.on_off){
        // Currently on. will be turning off.
        send_data = 'off';
      } else {
        // Currently off. will be turning on.
        send_data = 'on';
      }
      //console.log("click:", send_data)

      this.switched = !this.on_off;  // To trigger accessors.switched.set.
      this.tidyParent()

      var address = this.id.substr("ha-light-".length)
      var children = document.getElementById("ha-container-" + address)
          .getElementsByClassName("ha-container-children")[0].childNodes;
      var payload = {"_command" : send_data};
      if(children.length > 0){
        payload._subject = "homeautomation/0/" + address + "/_all";
      } else {
        payload._subject = "homeautomation/0/" + address;
      }
      Mqtt.send(payload._subject, payload);
      Page.AppendToLog(payload._subject, JSON.stringify(payload), "red")
    }
  }
});

xtag.register('ha-log', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-log').innerHTML;
      xtag.innerHTML(this, template);
    }
  },
});

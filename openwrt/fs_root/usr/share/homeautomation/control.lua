#!/usr/bin/lua

require 'helper_functions'

info.components = {}
info.thread_counter = 0


local control = {}
control.__index = control

function TableConcat(t1,t2)
	if t1 == nil then
		t1 = {}
  end

  for i=1, #t2 do
    t1[#t1 +1] = t2[i]
  end
  return t1
end

function control.new()
  log("control.new()")
  local self = setmetatable({}, control)

  if not is_file_or_dir(WEB_DIR) then
    log('Creating ' .. WEB_DIR)
    mkdir(WEB_DIR)
  end

  if not is_file_or_dir(TEMP_DIR) then
    log('Creating ' .. TEMP_DIR)
    mkdir(TEMP_DIR)
    mkdir(TEMP_DIR .. 'mosquitto/')
  end

  if is_file_or_dir(WEB_DIR) and is_file_or_dir(TEMP_DIR) then
    os.execute('ln -s ' .. TEMP_DIR .. 'control.txt ' .. WEB_DIR .. 'control.txt')
  end

  return self
end

function control:subscribe()
	local subscriptions = {}

  subscriptions[#subscriptions +1] = {role = 'control', address = '_announce'}

	return subscriptions
end

-- Publishes topics this module knows about. 
function control:announce()
  log("control:announce()")
  local topic = "homeautomation/0/control/_announce"

	for component_unique_id, component in pairs(info.components) do
		local payload = json.encode(component)
	  mqtt_instance:publish(topic, payload)
	end
end

-- This gets called whenever a topic this module is subscribed to appears on the bus.
function control:callback(path, incoming_data)
	log("control:callback(", path, incoming_data, ")")
  if path == nil or incoming_data == nil then 
    return
  end

  path = var_to_path(path)
  local role, address = path:match('(.-)/(.+)')
  if role == '_all' then
    role = 'control'
  end

	local incoming_command = incoming_data._command
	if incoming_command == 'solicit' then
    -- TODO Only one needs to respond if there is more than one of these on the network.
		self:announce()
  elseif incoming_data.unique_id then
    log(incoming_data.unique_id, flatten_data(incoming_data))
    local object = self:object_from_uid(incoming_data.unique_id)
    
    if(object == nil) then
      -- New object needed.
      if get_path(incoming_data, 'data.general.instance_name') and incoming_data.unique_id and incoming_data.object_type then
			  local instance_name = incoming_data.data.general.instance_name.value
				print('New object:', incoming_data.object_type, instance_name, incoming_data.unique_id)
				object = _G[incoming_data.object_type]:new{instance_name=instance_name, unique_id=incoming_data.unique_id}
      end
    end
		if(object ~= nil) then
      object:merge(incoming_data)
    end
	end
end

control.line_count = 0
function control:open_log()
  if not control.filehandle then
    control.filehandle = io.open(TEMP_DIR .. 'control.txt', "w")
  end
end

function control:update_log(data)
  --if info.host.processes.uhttpd.enabled == true then
    if(control.line_count > 1000) then
      control.filehandle:close()
      control.filehandle = nil
      control.line_count = 0
    end
    self:open_log()
    control.filehandle:write(tostring(control.line_count) .. ' ' .. os.date("%Y/%b/%d %I:%M:%S") .. '\t' .. data)
    control.line_count = control.line_count +1
  --end
end

function control:object_from_uid(unique_id)
  return info.components[unique_id]
end



-- Parent class for control components.
component = {}

function component:new(o)
  log('component:new()')
  o = o or {}
  
  setmetatable(o, self)
  self.__index = self

  if o.object_type then
    log('o.object_type:', o.object_type)
    self.object_type = o.object_type
  end
    
  if o.unique_id then
	  o:setup(o.instance_name, o.unique_id)
  end

  return o
end

function component:setup(instance_name, unique_id)
  log('component:setup(', instance_name, unique_id, ')')
  self.unique_id = unique_id
  self.object_type = self.object_type  -- Copy from constructor to object so it serialises using JSON methods.

  self.data = {}
  self.data.general = {}
  self.data.inputs = {}
  self.data.outputs = {}

  -- self._subject is the unique identifier on the web interface.
  -- TODO check for duplicate instance_name.
  self._subject = 'control/' .. instance_name
  
  self:add_general('instance_name', instance_name)

  -- Add number to any duplicate unique_id.
  local count = 0
  while info.components[unique_id] ~= nil do
    count = count +1
    unique_id = self.unique_id .. '-' .. tostring(count)
  end
  self.unique_id = unique_id
  info.components[unique_id] = self
end

function component:merge(new_data)
  if get_path(new_data, 'data.general.instance_name') then
    self:add_general('instance_name', new_data.data.general.instance_name.value)
  end

  if get_path(new_data, 'shape') then
    self.shape = new_data.shape
  end

	if get_path(new_data, 'data.outputs') then
    self.data.outputs = new_data.data.outputs
	end
end

function component:add_general(label, value)
  label = path_to_var(label)

  self.data.general[label] = {}
  self.data.general[label].value = value
end

function component:get_general(label)
  label = path_to_var(label)
  return self.data.general[label].value
end

function component:add_input(label, value)
  log("component:add_input(", label, value, ")")
  label = label or 'default_in'
  label = path_to_var(label)
  print('@@',label)
  self.data.inputs[label] = value
end

function component:add_link(destination_component, destination_port_label, source_port_label)
  source_port_label = source_port_label or 'default_out'
  destination_port_label = destination_port_label or 'default_in'

  if self.data.outputs[source_port_label] == nil then
    self.data.outputs[source_port_label] = {}
  end

  local found
  for index, existing_output in pairs(self.data.outputs[source_port_label]) do
    if existing_output.destination_object == destination_component.unique_id and
        existing_output.destination_port == destination_port_label and
        existing_output.source_port == source_port_label then
      found = true
    end
  end
  if found == nil then
    self.data.outputs[source_port_label][#self.data.outputs[source_port_label] +1] = {destination_object = destination_component.unique_id,
                                                                                      destination_port = destination_port_label,
                                                                                      source_port = source_port_label}
  end
end

function component:serialise()
	
end

function component:display()
  log('Name: ' .. self:get_general('instance_name'))
  for label, targets in pairs(self.data.outputs) do
    for _, target in pairs(targets) do
      log('  Output ' .. label .. ': ' .. target:get_general('instance_name'))
    end
  end
end

function component:send_output(data, output_label)
  if data == nil then
    return
  end

  if output_label ~= nil then
    self:send_one_output(data, output_label)
  else
    for label, _ in pairs(self.data.outputs) do
      self:send_one_output(data, label)
    end
  end
end

-- Send data to only one of the targets.
function component:send_one_output(data, label)
  --log("component:send_output(", data, label, ")")
  label = label or 'default_out'

  -- Send debug data.
  -- TODO. Allow this to be turned on/off.
  local topic = 'homeautomation/0/debug/' .. self.unique_id .. '/out/' .. label
  --local payload = flatten_data(data)
  local payload = json.encode(data)
  mqtt_instance:publish(topic, payload)
  control_instance:update_log(topic .. '\t' .. payload .. '\n')

  if label == '_drop' then
    --control_instance:update_log('(' .. self.object_type .. ')' .. self:get_general('instance_name') .. ' -> ' .. flatten_data(data) .. ' -> DROP\n')
    return
  end

  if self.data.outputs[label] then
    for _, link_data in pairs(self.data.outputs[label]) do
      log('component:send_one_output:', self.unique_id, label, '->', link_data.destination_object, link_data.destination_port)
      if(info.components[link_data.destination_object] and info.components[link_data.destination_object]:get_general('instance_name')) then
        local target_name = info.components[link_data.destination_object]:get_general('instance_name')
        --control_instance:update_log('(' .. self.object_type .. ')' .. self:get_general('instance_name') .. ' -> ' .. flatten_data(data) .. ' -> ' .. target_name .. '\n')
        info.components[link_data.destination_object]:receive_input(data, link_data.destination_port, self.unique_id, label)
      end
    end
  end
end

function component:receive_input(data, port_label, from_unique_id, from_port_label)
  port_label = port_label or 'default_in'

  if port_label == 'default_in' then
    -- Pasthrough this component and trigger the default output.
    self:send_output(data)
  end
end


FlowObjectMqttSubscribe = component:new({object_type='FlowObjectMqttSubscribe'})

function FlowObjectMqttSubscribe:setup(instance_name, unique_id)
	log('FlowObjectMqttSubscribe:setup(', instance_name, unique_id, ')')

  component.setup(self, instance_name, unique_id)
  info.mqtt.callbacks[instance_name] = self
end

function FlowObjectMqttSubscribe:receive_mqtt(data, label)
  --log(" ", "FlowObjectMqttSubscribe:receive_input() triggered", label)
  data.thread_track = {}
  data.thread_track[1] = info.thread_counter
  info.thread_counter = info.thread_counter +1
  self:send_output(data)
end

function FlowObjectMqttSubscribe:callback(path, data)
  --log(" ", "FlowObjectMqttSubscribe:callback(" .. tostring(path) .. ", " .. flatten_data(data) .. ")")

  path = var_to_path(path)
  self:receive_mqtt(data, path_to_var(path))
end

function FlowObjectMqttSubscribe:subscribe()
  local subscritions = {}
  --local path = path_to_var(self.data.general.subscribed_topic.value)
  print(self.data.inputs)
  print(flatten_data(self.data.inputs.subscription))
  local path = path_to_var(self.data.inputs.subscription.subscribed_topic.value)
  local role, address = path:match('(.-)__(.+)')
  if role and address then
    subscritions[#subscritions +1] = {role = role, address = address}
  end

  return subscritions
end


FlowObjectMapValues = component:new({object_type='FlowObjectMapValues'})

function FlowObjectMapValues:receive_input(data, l)
  --log(" ~~", "FlowObjectMapValues:receive_input(", flatten_data(data), l, ")")
  local label = self.data.inputs.default_in.label
  local rules = self.data.inputs.default_in.rules

  local found_label, found_value

  for data_label, data_value in pairs(data) do
    if label == data_label then
      found_label = label
      found_value = data_value
      --log(" ~~", found_label, found_value)
    end
  end

  for _, rule in pairs(rules) do
    -- TODO: We force everything to be a string here to handle booleans... Think about the implications of this.
    -- TODO: Handle numbers.
    if tostring(rule.match) == tostring(found_value) or rule.match == '_else' or (rule.match == '_missing' and found_label == nil) then
      if rule.action == '_forward' then
        --log("~~~~~", rule.match, '_forward', found_label, found_value)
        --log("~~~~~", flatten_data(data))
        self:send_output(data)
        break
      elseif rule.action == '_string' or rule.action == '_boolean' then
        --log("~~~~~", 'modify', found_label, found_value, rule.value)
        data[found_label] = rule.value
        --log("~~~~~", flatten_data(data))
        self:send_output(data)
        break
      elseif rule.action == '_drop' then
        --log("~~~~~", rule.match, '_drop')
        --control_instance:update_log('(' .. self.object_type .. ')' .. self:get_general('instance_name') .. ' -> ' .. flatten_data(data) .. ' -> DROP\n')
        self:send_output(data, '_drop')
        break
      end
    end
  end
end


FlowObjectMapLabels = component:new({object_type='FlowObjectMapLabels'})

function FlowObjectMapLabels:receive_input(data, l)
  --log(" ==", "FlowObjectMapLabels:receive_input(", data, l, ")")
  local forward_data = {thread_track = data.thread_track}
  local rules = self.data.inputs.default_in.rules

  for data_label, data_value in pairs(data) do
    for _, rule in pairs(rules) do
      if rule.match == data_label or rule.match == '_else' then
        if rule.action == '_forward' then
          forward_data[data_label] = data_value
          break
        elseif rule.action == '_string' then
          forward_data[rule.value] = data_value
          break
        elseif rule.action == '_drop' then
          break
        end
      end
    end
  end
  --log("=====", flatten_data(forward_data))
  self:send_output(forward_data)
end


FlowObjectMqttPublish = component:new({object_type='FlowObjectMqttPublish'})

function FlowObjectMqttPublish:receive_input(data, l)
	local topic = 'homeautomation/0/' .. self.data.general.publish_topic.value
	local payload = flatten_data(data)
	--log("&&&&& FlowObjectMqttPublish:receive_input:", topic, payload)
	mqtt_instance:publish(topic, payload)
end


FlowObjectReadFile = component:new({object_type='FlowObjectReadFile'})

function FlowObjectReadFile:add_link(destination_component, destination_port_label, source_port_label)
  component.add_link(self, destination_component, destination_port_label, source_port_label)

  -- First check file and read if new data:
  self:parse_data_from_file()

  -- Now send data.
  self:send_output()
end

function FlowObjectReadFile:parse_data_from_file()
	local filename = self.data.inputs.load_from_file.filename.value

  if is_file_or_dir(filename) then
    local file_last_read_at = file_mod_time(filename)
    if file_last_read_at ~= self.file_last_read_at then
      self.file_last_read_at = file_last_read_at
      self.data_entries = {}
      local file_handle = io.input(filename)
      for line in io.lines() do
        table.insert(self.data_entries, line)
      end
      file_handle:close()
    end
  end
end

function FlowObjectReadFile:receive_input(data, input_label)
	-- If data is sent to this Component, make it send data.

  local match_data_label = self.data.general.match_data_label.value
  local match_data_value = self.data.general.match_data_value.value

  if match_data_label ~= nil and data[match_data_label] == nil then
		-- Requested label not in incoming data.
    return
  end
	if match_data_label ~= nil and match_data_value == nil then
		-- Value has not been specified so match all entries equal to the one in data.
		match_data_value = data[match_data_label]
	end

  -- First check file and read if new data:
  self:parse_data_from_file()
  -- Now send data.
  self:send_output(match_data_label, match_data_value)
end

function FlowObjectReadFile:send_output(match_data_label, match_data_value)
  for _, file_data in pairs(self.data_entries) do
    local parsed_file_data = parse_payload(file_data)
    if parsed_file_data then
      if match_data_label == nil or parsed_file_data[match_data_label] == match_data_value then
        parsed_file_data.thread_track = {}
        parsed_file_data.thread_track[1] = info.thread_counter
        info.thread_counter = info.thread_counter +1

        --log('+++++', match_data_label, match_data_value, flatten_data(parsed_file_data))
        component.send_output(self, parsed_file_data)
        --self:send_output(parsed_file_data)
      end
    end
  end
end


FlowObjectCombineData = component:new({object_type='FlowObjectCombineData'})

function FlowObjectCombineData:setup(instance_name, unique_id)
  log('FlowObjectCombineData:setup(', instance_name, unique_id, ')')
  component.setup(self, instance_name, unique_id)
  self.data.data = {}
end

function FlowObjectCombineData:receive_input(data, input_label, from_unique_id, from_port_label)
  local primary_key_label = self.data.inputs.default_in.primary_key_label

  if data[primary_key_label] ~= nil then
    local primary_key = data[primary_key_label]
    if self.data.data[from_unique_id] == nil then
      self.data.data[from_unique_id] = {}
    end
    if self.data.data[from_unique_id][from_port_label] == nil then
      self.data.data[from_unique_id][from_port_label] = {}
    end
    if self.data.data[from_unique_id][from_port_label][primary_key] == nil then
      self.data.data[from_unique_id][from_port_label][primary_key] = {}
    end

    -- Store data, indexed by the object and port it came from.
    for label, value in pairs(data) do
      self.data.data[from_unique_id][from_port_label][primary_key][label] = value
    end

    -- Combine data from different sources.
    local output = {}
    output[primary_key_label] = primary_key
    for _from_unique_id, data1  in pairs(self.data.data) do
      for _from_port_label, data2  in pairs(data1) do
        if data2[primary_key] ~= nil then
          for label, value in pairs(data2[primary_key]) do
            if label == 'thread_track' then
              output.thread_track = TableConcat(output.thread_track, value)
            else
              output[label] = value
            end
          end
        end
      end
    end

		self:send_output(output)
  end
end


FlowObjectAddData = component:new({object_type='FlowObjectAddData'})

function FlowObjectAddData:setup(instance_name, unique_id)
  log('FlowObjectAddData:setup(', instance_name, unique_id, ')')
  component.setup(self, instance_name, unique_id)
  self.data.data = {}
end

function FlowObjectAddData:receive_input(data, input_label)
  --log("'''''", flatten_data(data))
  local primary_key_label = self.data.inputs.default_in.primary_key_label

  if data[primary_key_label] == nil then
    return
  end

  local primary_key = data[primary_key_label]

  for label, value in pairs(data) do
    if self.data.data[primary_key] == nil then
      self.data.data[primary_key] = {}
    end
    self.data.data[primary_key][label] = value
  end

	local combined_entry = {}
	for _, entry in pairs(self.data.data) do
		for label, value in pairs(entry) do
			if label ~= primary_key_label then
        --log("'''''", "", label, value)
        if label == 'thread_track' then
          combined_entry[label] = TableConcat(combined_entry[label], value)
        elseif combined_entry[label] == nil then
          if tonumber(value) ~= nil then
            --log("'''''", "", 'number')
            combined_entry[label] = tonumber(value)
          elseif toBoolean(value) ~= nil then
            --log("'''''", "", 'bool')
            combined_entry[label] = toBoolean(value)
          elseif type(value) == 'string' then
            --log("'''''", "", 'string')
            combined_entry[label] = value
          end
        elseif type(combined_entry[label]) == 'string' then
          if tonumber(value) ~= nil or toBoolean(value) ~= nil then
            -- A string will take precedence over a number or a boolean.
          elseif type(value) == 'string' then
            combined_entry[label] = combined_entry[label] .. ' | ' .. value
          end            
        elseif type(combined_entry[label]) == 'number' then
          if tonumber(value) ~= nil then
            combined_entry[label] = combined_entry[label] + tonumber(value)
          elseif toBoolean(value) ~= nil then
            -- We want a logical OR so   number||bool = number .
          elseif type(value) == 'string' then
            -- A string will take precedence over a number or a boolean.
            combined_entry[label] = value
          end
        elseif type(combined_entry[label]) == 'boolean' then
          combined_entry[label] = combined_entry[label] or value
        end
      end
    end
	end
	--log("'''''", flatten_data(combined_entry))
	self:send_output(combined_entry)
end


function toBoolean(value)
  if type(value) == 'boolean' then
    return value
  end
  if type(value) == 'string' then
    if value:lower() == 'false' then
      return false
    end
    if value:lower() == 'true' then
      return true
    end
  end
  if type(value) == 'number' then
    return not not value
  end
  return nil
end

function flatten_data(data_in)
  if data_in then
    local data_out = ''
    for key, value in pairs(data_in) do
      data_out = data_out .. key .. ' : ' .. tostring(value) .. ' , '
    end

    return data_out:sub(0, -3)
  end
  return ''
end


FlowObjectAddTime = component:new({object_type='FlowObjectAddTime'})

function FlowObjectAddTime:receive_input(data, l)
  --log(" ^^", "FlowObjectAddTime:receive_input(", flatten_data(data), l, ")")

  data._time_weekday = os.date('%w')
  data._time_hour = os.date('%H')
  data._time_minute = os.date('%M')
  
  --log(" ^^", "FlowObjectAddTime:receive_input(", flatten_data(data), l, ")")
	self:send_output(data)
end





return control


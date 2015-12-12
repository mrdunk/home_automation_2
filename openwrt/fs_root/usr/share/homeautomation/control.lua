#!/usr/bin/lua

-- # opkg install luci-lib-json
local json = require "luci.json"

info.components = {}


local control = {}
control.__index = control

function control.new()
  print("control.new()")
  local self = setmetatable({}, control)

	-- init stuff here.

  return self
end

function control:subscribe()
	local subscriptions = {}

	subscriptions[#subscriptions +1] = {role = 'component', address = 'current'}

	return subscriptions
end

-- Publishes topics this module knows about. 
function control:announce()
  print("control:announce()")
  local topic = "homeautomation/0/control/_announce"

	for component_name, component in pairs(info.components) do
		local payload = json.encode(component)
	  mqtt_instance:publish(topic, payload)
	end
end

-- This gets called whenever a topic this module is subscribed to appears on the bus.
function control:callback(path, incoming_data)
	print("control:callback(", path, incoming_data, ")")
  path = var_to_path(path)
  local role, address = path:match('(.-)/(.+)')
  if role == '_all' then
    role = 'control'
  end

	local incoming_command = incoming_data._command
	if incoming_command == 'solicit' then
		self:announce()
	end
end




-- Parent class for control components.
component = {}

function component:new(o)
  print("component.new()")

  o = o or {}
  setmetatable(o, self)
  self.__index = self

  return o
end

function component:setup(class_name, instance_name)
  self.class_name = class_name
  self.instance_name = instance_name
  self.data = {}
  self.data.general = {}
  self.data.inputs = {default = {}}
  self.data.outputs = {default = {}}

  -- Add number to any duplicate names.
  local count = 0
  while info.components[instance_name] ~= nil do
    count = count +1
    instance_name = self.instance_name .. '-' .. tostring(count)
  end
  if self.instance_name ~= instance_name then
    info.components[instance_name] = "ERROR: Duplicate instance_name."
    return
  end
  info.components[instance_name] = self
end

function component:add_general(label, value)
  label = path_to_var(label)

  self.data.general[label] = value
end

function component:add_input(label, value)
  print("component:add_input(", label, ")")
  label = label or 'default'
  label = path_to_var(label)
  
  self.data.inputs[label] = value
end

function component:add_output(output, label)
  label = label or 'default'

  if self.data.outputs[label] == nil then
    self.data.outputs[label] = {}
  end

  local found
  for index, existing_output in pairs(self.data.outputs[label]) do
    if existing_output == output.instance_name then
      found = true
    end
  end
  if found == nil then
    self.data.outputs[label][#self.data.outputs[label] +1] = output.instance_name
  end
end

function component:serialise()
	
end

function component:display()
  print('Name: ' .. self.instance_name)
  for label, targets in pairs(self.data.outputs) do
    for _, target in pairs(targets) do
      print('  Output ' .. label .. ': ' .. target.instance_name)
    end
  end
end

function component:send_output(data)
  for label, _ in pairs(self.data.outputs) do
    self:send_one_output(data, label)
  end
end

-- Send data to only one of the targets.
function component:send_one_output(data, label)
  --print("component:send_output(", data, label, ")")
  label = label or 'default'

  if self.data.outputs[label] then
    for _, target_name in pairs(self.data.outputs[label]) do
      info.components[target_name]:receive_input(data, label)
    end
  end
end

function component:receive_input(data, label)
  label = label or 'default'

  if label == 'default' then
    -- Pasthrough this component and trigger the default output.
    self:send_output(data)
  end
end



component_mqtt_subscribe = component:new()

function component_mqtt_subscribe:setup(class_name, instance_name)
  component.setup(self, class_name, instance_name)
  info.mqtt.callbacks[instance_name] = self
end

function component_mqtt_subscribe:receive_mqtt(data, label)
  print(" ", "component_mqtt_subscribe:receive_input() triggered", label)
  self:send_output(data)
end

function component_mqtt_subscribe:callback(path, data)
  --print(" ", "component_mqtt_subscribe:callback(" .. tostring(path) .. ", " .. flatten_data(data) .. ")")

  path = var_to_path(path)
  self:receive_mqtt(data, path_to_var(path))
end

function component_mqtt_subscribe:subscribe()
  local subscritions = {}
  local path = path_to_var(self.data.general.subscribed_topic)
  local role, address = path:match('(.-)__(.+)')
  if role and address then
    subscritions[#subscritions +1] = {role = role, address = address}
  end

  return subscritions
end


component_map_values = component:new()

function component_map_values:receive_input(data, l)
  print(" ~~", "component_map_values:receive_input(", flatten_data(data), l, ")")
  local label = self.data.inputs.default.label
  local rules = self.data.inputs.default.rules

  local found_label, found_value

  for data_label, data_value in pairs(data) do
    if label == data_label then
      found_label = label
      found_value = data_value
      print(" ~~", found_label, found_value)
    end
  end

  for _, rule in pairs(rules) do
    -- TODO: We force everything to be a string here to handle booleans... Think about the implications of this.
    if tostring(rule.match) == tostring(found_value) or rule.match == '_else' or (rule.match == '_missing' and found_label == nil) then
      if rule.action == 'forward' then
        print("~~~~~", rule.match, 'forward', found_label, found_value)
        print("~~~~~", flatten_data(data))
        self:send_output(data)
        break
      elseif rule.action == 'string' or rule.action == 'boolean' then
        print("~~~~~", 'modify', found_label, found_value, rule.value)
        data[found_label] = rule.value
        print("~~~~~", flatten_data(data))
        self:send_output(data)
        break
      elseif rule.action == 'drop' then
        print("~~~~~", rule.match, 'drop')
        break
      end
    end
  end
end


component_map_labels = component:new()

function component_map_labels:receive_input(data, l)
  print(" ==", "component_map_labels:receive_input(", data, l, ")")
  local forward_data = {}
  local rules = self.data.inputs.default.rules

  for data_label, data_value in pairs(data) do
    for _, rule in pairs(rules) do
      if rule.match == data_label or rule.match == '_else' then
        if rule.action == 'forward' then
          forward_data[data_label] = data_value
          break
        elseif rule.action == 'string' then
          forward_data[rule.value] = data_value
          break
        elseif rule.action == 'drop' then
          break
        end
      end
    end
  end
  print("=====", flatten_data(forward_data))
  self:send_output(forward_data)
end


component_time_window = component:new()

function component_time_window:receive_input(data, l)
  -- TODO: Make 2 outputs: one for within_window and one for outside_window.
  -- TODO: Make this re-send last received data whenever we tick over to within_window/outside_window.

  print(" @@", "component_time_window:receive_input(", data, l, ")")
  self.last_data = data

  local forward_data = {}

  if in_time_window(tonumber(self.data.general.start_time), tonumber(self.data.general.end_time), tonumber(os.date('%H'))) then
    if self.data.general.within_window.action == 'forward' then
      forward_data = data
    elseif self.data.general.within_window.action == 'custom' then
      local label = self.data.general.within_window.label
      local value = self.data.general.within_window.value
      if label ~= nil and value ~= nil then
        forward_data[label] = value
      end
    end
  else
    if self.data.general.outside_window.action == 'forward' then
      forward_data = data
    elseif self.data.general.outside_window.action == 'custom' then
      local label = self.data.general.outside_window.label
      local value = self.data.general.outside_window.value
      if label ~= nil and value ~= nil then
	      forward_data[label] = value
			end
    end
	end
	print("@@@@@", flatten_data(forward_data))
	self:send_output(forward_data)
end

function in_time_window(time_start, time_end, time_now)
	while time_now >= 24 do
		time_now = time_now - 24
	end

  if time_start < time_end then
    if time_start <= time_now and time_end > time_now then
      return true
    end
  else
		-- Time window straddles midnight.
    if time_start <= time_now and 24 > time_now then
      return true
    elseif 0 <= time_now and time_end > time_now then
      return true
    end
	end

  return false
end


component_publish = component:new()

function component_publish:receive_input(data, l)
	local topic = 'homeautomation/0/' .. self.data.general.publish_topic
	local payload = flatten_data(data)
	print("&&&&& component_publish:receive_input:", topic, payload)
	mqtt_instance:publish(topic, payload)
end


component_read_file = component:new()

function component_read_file:add_output(output, label)
  component.add_output(self, output, label)

  -- First check file and read if new data:
  self:parse_data_from_file()

  -- Now send data.
  self:send_output()
end

function component_read_file:parse_data_from_file()
	local filename = self.data.general.filename

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

function component_read_file:receive_input(data, input_label)
	-- If data is sent to this Component, make it send data.

  local match_data_label = self.data.general.match_data_label
  local match_data_value = self.data.general.match_data_value

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

function component_read_file:send_output(match_data_label, match_data_value)
  for _, file_data in pairs(self.data_entries) do
    local parsed_file_data = parse_payload(file_data)
    if parsed_file_data then
      if match_data_label == nil or parsed_file_data[match_data_label] == match_data_value then
        print('+++++', match_data_label, match_data_value, flatten_data(parsed_file_data))
	      component.send_output(self, parsed_file_data)
      end
    end
  end
end


component_combine = component:new()

function component_combine:setup(class_name, instance_name)
  component.setup(self, class_name, instance_name)
  self.data.data = {}
end

function component_combine:receive_input(data, input_label)
  local primary_key_label = self.data.general.primary_key_label

  if data[primary_key_label] ~= nil then
    local primary_key = data[primary_key_label]
    for label, value in pairs(data) do
      if self.data.data[primary_key] == nil then
        self.data.data[primary_key] = {}
      end
      self.data.data[primary_key][label] = value
    end
    print("-----", flatten_data(self.data.data[primary_key]))
		self:send_output(self.data.data[primary_key])
  end
end


component_add_messages  = component:new()

function component_add_messages:setup(class_name, instance_name)
  component.setup(self, class_name, instance_name)
  self.data.data = {}
end

function component_add_messages:receive_input(data, input_label)
  print("'''''", flatten_data(data))
	local primary_key_label = self.data.general.primary_key_label

	if data[primary_key_label] ~= nil then
    local primary_key = data[primary_key_label]
    for label, value in pairs(data) do
      if self.data.data[primary_key] == nil then
        self.data.data[primary_key] = {}
      end
      self.data.data[primary_key][label] = value
    end
  end

	local combined_entry = {}
	for _, entry in pairs(self.data.data) do
		for label, value in pairs(entry) do
			if label ~= primary_key_label then
				if tonumber(value) ~= nil and (combined_entry[label] == nil or type(combined_entry[label]) == number) then
					if combined_entry[label] == nil then
						combined_entry[label] = 0
					end
					combined_entry[label] = combined_entry[label] + tonumber(value)
        elseif (value == 'true' or value == 'false') and (combined_entry[label] == nil or type(combined_entry[label]) == boolean) then
          if combined_entry[label] == nil then
            combined_entry[label] = false
          end
          combined_entry[label] = combined_entry[label] or (value == 'true')
				end
			end
		end
	end
	print("'''''", flatten_data(combined_entry))
	self:send_output(combined_entry)
end


function flatten_data(data_in)
  if data_in then
    local data_out = ''
    for key, value in pairs(data_in) do
      data_out = data_out .. key .. ' : ' .. tostring(value) .. ' , '
    end

    return data_out:sub(0, -3)
  end
end

return control

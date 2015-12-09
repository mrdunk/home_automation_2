#!/usr/bin/lua


component = {}

function component:new(o)
  print("component.new()")

  o = o or {}
  setmetatable(o, self)
  self.__index = self

  return o
end

function component:setup(name)
  self.name = name
  self.data = {}
  self.data.general = {}
  self.data.inputs = {default = {}}
  self.data.outputs = {default = {}}
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
  for index in next, self.data.outputs[label] do
    if self.data.outputs[label][index] == output then
      found = true
    end
  end
  if found == nil then
    self.data.outputs[label][#self.data.outputs +1] = output
  end
end

function component:display()
  print('Name: ' .. self.name)
  for label, targets in pairs(self.data.outputs) do
    for _, target in pairs(targets) do
      print('  Output ' .. label .. ': ' .. target.name)
    end
  end
end

function component:send_output(data)
  for label, _ in pairs(self.data.outputs) do
    self:send_one_output(data, label)
  end
end

function component:send_one_output(data, label)
  --print("component:send_output(", data, label, ")")
  label = label or 'default'

  if self.data.outputs[label] then
    for _, target in pairs(self.data.outputs[label]) do
      target:receive_input(data, label)
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

function component_mqtt_subscribe:setup(name)
  component.setup(self, name)
  info.mqtt.callbacks[name] = self
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
  print(" ~~", "component_map_values:receive_input(", data, l, ")")
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
    if rule.match == found_value or rule.match == '_else' or (rule.match == '_missing' and found_label == nil) then
      if rule.action == 'forward' then
        print("~~~~~", 'forward', found_label, found_value)
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
        print("~~~~~", 'drop')
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


-- Used to display data for debug
function flatten_data(data_in)
  local data_out = ''
  for key, value in pairs(data_in) do
    data_out = data_out .. key .. ' : ' .. value .. ' , '
  end

  return data_out:sub(0, -3)
end



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
  value = path_to_var(value)

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



component_mqtt_listener = component:new()

function component_mqtt_listener:setup(name)
  component.setup(self, name)
  info.mqtt.callbacks[name] = self
end

function component_mqtt_listener:receive_mqtt(data, label)
  print(" ", "component_mqtt_listener:receive_input() triggered", label)
  self:send_output(data)
end

function component_mqtt_listener:callback(path, data)
  --print(" ", "component_mqtt_listener:callback(" .. tostring(path) .. ", " .. tostring(data) .. ")")

  path = var_to_path(path)
  self:receive_mqtt(data, path_to_var(path))
end

function component_mqtt_listener:subscribe()
  local subscritions = {}
  local path = self.data.general.subscribed_topic
  local role, address = path:match('(.-)__(.+)')
  if role and address then
    subscritions[#subscritions +1] = {role = role, address = address}
  end

  return subscritions
end



-- TODO much temporary stuff here to hard code the christmas tree lights
component_field_watcher = component:new()

function component_field_watcher:receive_input(data, label)
  print(" *", "component_field_watcher:receive_input(", data, label, ")")
  local reachable, address
  for key, value in pairs(data) do
    --print(" ", key, tostring(value))
    if key == '_reachable' then
      reachable = value
    elseif key == '_address' then
      address = value
    end
  end

  if address == '192.168.192.200' then
    local hour = tonumber(os.date('%H'))
    local topic = 'homeautomation/0/lighting/extension/jess_warning_lamp'
    local payload = '_command:'
    if reachable == 'true' and hour >= 6 and hour <= 22 then
      payload = payload .. 'on'
    else
      payload = payload .. 'off'
    end
    print('####', topic, payload)
    mqtt_instance:publish(topic, payload)
  end
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

-- Used to display data for debug
function flatten_data(data_in)
  local data_out = ''
  for key, value in pairs(data_in) do
    data_out = data_out .. key .. ' : ' .. value .. ' , '
  end

  return data_out:sub(0, -3)
end



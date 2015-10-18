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
  self.inputs = {default = {}}
  self.outputs = {default = {}}
end

function component:add_input(label)
  print("component:add_input(", label, ")")
  label = label or 'default'
  label = path_to_var(label)
  
  if self.inputs[label] == nil then
    self.inputs[label] = true
    print("*")
  end
end

function component:add_output(output, label)
  label = label or 'default'

  if self.outputs[label] == nil then
    self.outputs[label] = {}
  end

  local found
  for index in next, self.outputs[label] do
    if self.outputs[label][index] == output then
      found = true
    end
  end
  if found == nil then
    self.outputs[label][#self.outputs +1] = output
  end
end

function component:display()
  print('Name: ' .. self.name)
  for label, targets in pairs(self.outputs) do
    for _, target in pairs(targets) do
      print('  Output ' .. label .. ': ' .. target.name)
    end
  end
end

function component:send_output(data, label)
  print("component:send_output(", data, label, ")")
  label = label or 'default'

  if self.outputs[label] then
    for _, target in pairs(self.outputs[label]) do
      target:receive_input(data)
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

function component_mqtt_listener:receive_input(data, label)
  print("component_mqtt_listener:receive_input(" .. tostring(data) .. ", " .. tostring(label) .. ")")

  label = label or 'default'
  
  if label == 'default' then
    print(self.name .. ' default mqtt_listener.receive_input() triggered.')
  else
    print("component_mqtt_listener:receive_input() triggered")
    self:send_output(data)
  end
end

function component_mqtt_listener:callback(path, data)
  print("component_mqtt_listener:callback(" .. tostring(path) .. ", " .. tostring(data) .. ")")

  path = var_to_path(path)
  self:receive_input(data, path_to_var(path))
end

function component_mqtt_listener:subscribe()
  local subscritions = {}
  for path, _ in pairs(info.mqtt.callbacks[self.name].inputs) do
    path = var_to_path(path)
    local role, address = path:match('(.-)/(.+)')
    if role and address then
      print(path, role, address)
      subscritions[#subscritions +1] = {role = role, address = address}
    end
  end
  return subscritions
end



component_cache = component:new()

function component_cache:receive_input(data, label)
  print("component_cache:receive_input(", data, label, ")")
  label = label or 'default'

  if info.cache == nil then
    info.cache = {}
  end
  if info.cache[label] == nil then
    info.cache[label] = {}
  end

  if label == 'resend' then
    self:send_output(info.cache)
  else
    info.cache[label] = data
  end
end




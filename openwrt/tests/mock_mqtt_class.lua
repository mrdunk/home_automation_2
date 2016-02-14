#!/usr/bin/lua


local mqtt = {}
mqtt.__index = mqtt

function mqtt:new()
  local self = {}
  setmetatable(self, mqtt)
  return self
end

function mqtt:publish(topic, payload)
	log('mqtt:publish(', topic, payload, ')')
end

return mqtt


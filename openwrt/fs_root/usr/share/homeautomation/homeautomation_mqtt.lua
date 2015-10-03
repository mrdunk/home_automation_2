#!/usr/bin/lua

--[[ In an ideal world we would use the OpenWRT lua-mosquitto package.
    Unfortunately lua-mosquitto is only available on later versions of OpenWRT.
    (Chaos Calmer and above.)

    Since the Kankun sockets are only running Barrier Breaker by default,
    here we will call the command line Mosquitto client and parse the return from that. ]]--


local mqtt = {}
mqtt.__index = mqtt

local mosquitto_pub = '/usr/bin/mosquitto_pub'
local mosquitto_sub = '/usr/bin/mosquitto_sub'
local topic_log = '/tmp/mqtt_topic.log'
local max_filesize = 100000

function mqtt.ON_CONNECT()
  --print("Default mqtt.ON_CONNECT")
end


function mqtt.ON_MESSAGE(mid, topic, payload)
  --print("Default mqtt.ON_MESSAGE", mid, topic, payload)
end

function mqtt.ON_PUBLISH()
  --print("Default mqtt.ON_PUBLISH")
end


function mqtt:new()
  local self = {}
  setmetatable(self, mqtt)
  self.connection = {}
  self.subscriptions = {}
  self.subscribe_error = false;
  self.loopcount = 0;
  return self
end


function mqtt.test(broker, port)
  if broker and port then
    local command = mosquitto_pub .. ' -h ' .. broker .. ' -p ' .. port .. ' -t test/test -m test 2> /dev/null'
    return os.execute(command) == 0
  end
  return nil
end


function mqtt:connect(broker, port)
  self.connection.broker = broker
  self.connection.port = port

  local return_value = self.test(broker, port)

  if not return_value then
    --print('Could not connect to:', self.connection.broker, self.connection.port)
    return nil
  end

  --print("Connected to: ", broker, port)

  self.ON_CONNECT()

  return true
end


function mqtt:publish(topic, payload)
  local command = mosquitto_pub .. ' -h ' .. self.connection.broker .. ' -p ' .. self.connection.port .. ' -t ' .. topic .. ' -m "' .. payload .. '"'
  local return_value = os.execute(command)

  self.ON_PUBLISH()
end


function mqtt:loop()
  local keep_looping = true
  for filename, data in pairs(self.subscriptions) do
    local filesize
    if data.filehandle == nul then
      self.subscriptions[filename].filehandle = io.open(filename, "r")
      --print(self.subscriptions[filename].filehandle)
    end
    filehandle = self.subscriptions[filename].filehandle
    if filehandle then
      local line = filehandle:read("*line")
      if line then 
        local topic
        local payload
        topic, payload = string.match(line, '^%s*([%w_%-/]+)%s+(.+)%s*$')
        self.ON_MESSAGE(0, topic, payload)
        self.loopcount = 0
      else
        filesize = filehandle:seek("end")
      end
    end

    -- If file getting too big...
    if filesize and filesize > max_filesize then
      print("file: ", filename, "\tfilesize: ", filesize)
      print("Restarting to clear cache files.")
      keep_looping = false
    end
  end

  self.loopcount = self.loopcount +1
  if self.loopcount > 60 then
    -- Test if we can still contact broker after 60 seconds idle.
    self.loopcount = 0
    return self.test(self.connection.broker, self.connection.port)
  end

  if self.loopcount > 0 then
    os.execute("sleep 1")
  end

  return keep_looping and not self.subscribe_error
end


function mqtt:subscribe(topic)
  self.subscribe_error = false

  local command = mosquitto_sub .. ' -v -h ' .. self.connection.broker .. ' -p ' .. self.connection.port .. ' -t ' .. topic

  -- See if we already have a subscription running and kill it if we do.
  local bash_kill_old = 'PID=$(echo $(ps | grep -v grep | grep "' .. command .. '") | cut -f1 -d" "); '
  bash_kill_old = bash_kill_old .. 'if [ $PID ]; then kill $PID; fi '
  
  os.execute(bash_kill_old)
  os.execute(bash_kill_old)  -- If we somehow ended up with multiple mosquitto_sub commands running...

  local sanitised_topic = topic:gsub("/", "..")
  local filename = topic_log .. '..' .. sanitised_topic
  

  print("Starting subscription for " .. topic)
  local redirect = ' > ' .. filename .. ' &'
  local return_value = os.execute(command .. redirect)
  if return_value ~= 0 then
    print('Problem starting "' .. command .. redirect .. '"')
    self.subscribe_error = true
    return
  end
  
  -- Build dict of filename : command.
  self.subscriptions[filename] = {command=command}
end


return mqtt

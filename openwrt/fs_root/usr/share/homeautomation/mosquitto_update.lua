#!/usr/bin/lua


-- Create a mosquitto config file with information about other brokers we intend to form bridges with.
-- Only needed if this host is running a mosquitto broker.
function update_mosquitto_config()
  if info.host.processes['avahi-daemon'].enabled ~= true then
    return
  end
  if info.host.processes.mosquitto.enabled ~= true then
    return
  end

  info.brokers.DEBUG = ''
  local config = {}

  -- Parse existing config.
  local file_handle = io.open("/tmp/homeautomation/mosquitto/bridges.conf", "r")
  if file_handle then
    for line in file_handle:lines() do
      local key, content = string.match(line, "^(%a+)%s+(.+)%s*$")
      if key == 'address' then
        local address, port = string.match(content, "^([%da-f:.]+):(%d+)%s*$")
        if port == nil then 
          port = '1883'
        end
        config[address] = port
        info.brokers.DEBUG = info.brokers.DEBUG .. " " .. address .. ":" .. port
      end
    end
    file_handle:close()
  else
    print('No file: /tmp/homeautomation/mosquitto/bridges.conf')
    info.brokers.DEBUG = info.brokers.DEBUG .. " No file."
  end

  info.brokers.DEBUG = info.brokers.DEBUG .. " | "

  -- Compare to detected brokers on network.
  local new_file = false
  for broker, connections in pairs(info.brokers) do
    if type(connections) == 'table' then
      local reachable_connection, in_file
      for connection_id, connection in pairs(connections) do
        if connection.reachable == true and broker ~= "localhost" then
          reachable_connection = connection
          if config[connection.address] ~= nil and config[connection.address] == connection.port then
            -- Is already in file.
            in_file = true
            info.brokers.DEBUG = info.brokers.DEBUG .. " in_file:" .. connection.address
            break
          end
        end
      end
      info.brokers.DEBUG = info.brokers.DEBUG .. " not in_file"

      if reachable_connection and not in_file then
        -- Since none of the connections are in the file, it needs updated.
        new_file = true
        info.brokers.DEBUG = info.brokers.DEBUG .. " reachable"
      end
    end
  end

  info.brokers.DEBUG = info.brokers.DEBUG .. " | "

  -- Write a new file if it needs done.
  if new_file == true then
    info.brokers.DEBUG = info.brokers.DEBUG .. " writing "

    file_handle = io.open("/tmp/homeautomation/mosquitto/bridges.tmp", "w")
    if file_handle then
      for broker, connections in pairs(info.brokers) do
        if type(connections) == 'table' then
          for connection_id, connection in pairs(connections) do
            if connection.reachable == true and broker ~= "localhost" then
              file_handle:write('connection ' .. info.host.hostname .. '_to_' .. broker .. '\n')
              file_handle:write('address ' .. connection.address .. ':' .. connection.port .. '\n')
              file_handle:write('topic # in 1 homeautomation/1/ homeautomation/0/ \n\n')
              break
            end
          end
        end
      end
      file_handle:close()
      mv("/tmp/homeautomation/mosquitto/bridges.tmp", "/tmp/homeautomation/mosquitto/bridges.conf")
      info.needs_reload = true
    end

    -- And restart mosquitto.
    if info.needs_reload == true then
      info.brokers.DEBUG = info.brokers.DEBUG .. " restarting mosquitto "
      print("restarting mosquitto")
      info.needs_reload = os.execute("/etc/init.d/mosquitto restart") ~= 0
    end
  end
end

#!/usr/bin/lua

--[[ Library for reading configuration files. ]]--

local homeautomation_config = {}



local default_broker = 'localhost'
local default_port = '1883'


homeautomation_config.configuration = {}
homeautomation_config.configuration['avahi'] = false
homeautomation_config.configuration['brokers'] = {}
homeautomation_config.configuration['brokers'][default_broker .. ',' .. default_port] = {broker = default_broker, port = default_port}


local function parseLine(line)
  local label, value
  if line then
    -- Remove comments. (Comments start with "#".)
    if string.find(line, "#") then
      line = string.match(line, "^(.-)%s?#")
    end

    label = string.match(line, "^(.-)%s?:")
    value = string.match(line, "^.-:%s?(.*)$")
  end

  return label, value
end

function homeautomation_config.read(file_name)
  local config_file = io.open(file_name, "r")
  print("Reading " .. file_name)

  if config_file then
    local current_id
    local current_object = {}
    local line
    for line in config_file:lines() do
      local label, value = parseLine(line)
      if label then
        if label == "id" then
          if current_id then
            homeautomation_config.configuration[current_id] = current_object
          end
          current_id = value
          current_object = {}
        elseif label == "broker" then
          local broker, port
          broker, port = string.match(value, "^%s?([%w%.:]*)%s?[,;]-%s?(%d*)%s?$")
          if broker == "" or broker == nil then
            broker = default_broker
          end
          if port == "" or port == nil then
            port = default_port
          end
          print(value, broker, port)
          if broker == "avahi" then
            homeautomation_config.configuration['avahi'] = true
          else
            homeautomation_config.configuration['brokers'][broker .. ',' .. port] = {broker=broker, port=port}
          end
        else
          if current_id == nil then
            print("Missing 'id' in config file before " .. label .. ":" .. value)
            os.exit()
          end
          current_object[label] = value
        end
      end
    end
    config_file:seek("set", 0)

    if current_id then
      homeautomation_config.configuration[current_id] = current_object
    end

    config_file:close()
    return true
  end
  return false
end

return homeautomation_config

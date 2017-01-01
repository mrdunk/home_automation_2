#!/usr/bin/lua


local DHCP_FILE = '/tmp/dhcp.leases'


local dhcp_parser = {}
dhcp_parser.__index = dhcp_parser


function dhcp_parser.new()
  log("dhcp_parser.new()")

  local self = setmetatable({}, dhcp_parser)
  
  if info.io == nil then
    info.io = {}
  end
  if info.io.dhcp == nil then
    info.io.dhcp = {}
    info.io.dhcp._updated = os.date("*t")
  end
  if info.mqtt == nil then
    info.mqtt = {}
  end
--  if info.mqtt.subscription_loaders == nil then
--    info.mqtt.subscription_loaders = {}
--  end
--  if info.mqtt.announcer_loaders == nil then
--    info.mqtt.announcer_loaders = {}
--  end

--  info.mqtt.subscription_loaders['dhcp'] = self.subscribe
--  info.mqtt.announcer_loaders['dhcp'] = self.announce

  return self
end

function dhcp_parser:read_dhcp()
  local update

  local file_mod_time_string = file_mod_time(DHCP_FILE)
  if file_mod_time_string ~= info.io.dhcp._file_update_time then
    info.io.dhcp._file_update_time = file_mod_time_string
    log('dhcp_parser:read_dhcp():  reading:', DHCP_FILE)

    -- Read dhcp leases file to see what's actually been on the network recently.
    local file_handle = io.open(DHCP_FILE, "r")
    if file_handle then
      for line in file_handle:lines() do
        local mac, address, name = string.match(line, "^%s*%d+%s+([%x:]+)%s+([%d\.]+)%s+([%w_-%*]+)")
        mac = sanitize_mac_address(mac)
        address = sanitize_network_address(address)
        name = sanitize_text(name)
      
        if info.io.dhcp[mac] == nil then
          log('dhcp_parser:read_dhcp():  new record:', mac)
          info.io.dhcp[mac] = {}
          info.io.dhcp[mac].__update = true
        end
        if info.io.dhcp[mac].address ~= address then
          log('dhcp_parser:read_dhcp():  updated network address:', address)
          info.io.dhcp[mac].address = address
          info.io.dhcp[mac].__update = true
        end
        if info.io.dhcp[mac].dhcp_name ~= name then
          log('dhcp_parser:read_dhcp():  updated dhcp_name:', name)
          info.io.dhcp[mac].dhcp_name = name
          info.io.dhcp[mac].__update = true
        end
      end
      file_handle:close()
    end
  end

  -- Check devices are actually reachable on the network.
  for stored_mac, device in pairs(info.io.dhcp) do
    if string.sub(stored_mac, 1, 1) ~= '_' then
      local reachable = false
      -- Android devices (and presumably others) running on battery will not reply
      -- to ICMP requests (eg, ping) but an arping will still elicit a response.
      if device.address and
          os.execute('arping -c5 -f ' .. device.address .. ' 1> /dev/null') == 0 then
        -- Is reachable.
        reachable = true
      end
      if info.io.dhcp[stored_mac].reachable ~= reachable then
        log('dhcp_parser:read_dhcp():  updated reachable:', stored_mac, device.address, reachable)
        info.io.dhcp[stored_mac].reachable = reachable
        info.io.dhcp[stored_mac].__update = true
      end
    end
  end

  local since_force_update = math.abs(os.date("*t").min - info.io.dhcp._updated.min)
  if (since_force_update >= 5) then
    -- A force update is happening this round so reset timer.
    -- TODO Make the "5" delay configurable.
    info.io.dhcp._updated = os.date("*t")
  end
  self:publish_dhcp(since_force_update < 5)

  return
end

function dhcp_parser:publish_one_record(mac_address, check_if_updated)
  if string.sub(mac_address, 1, 1) == '_' then
    return
  end
  if type(info.io.dhcp[mac_address]) ~= 'table' then
    return
  end
  if (check_if_updated == true and info.io.dhcp[mac_address].__update ~= true) then
    return
  end
  info.io.dhcp[mac_address].__update = nil

  local topic = "homeautomation/0/dhcp/_announce"
  local payload = "_subject : dhcp/" .. mac_address
  for label, data in pairs(info.io.dhcp[mac_address]) do
    if data ~= nil then
      payload = payload .. ", _" .. label .. " : " .. tostring(data)
    end
  end
  log(topic, payload)
  mqtt_instance:publish(topic, payload)

  -- Make sure we are subscribed to messages sent to this target.
  -- We need to do this here because a dhcp lease may not have been given yet when
  -- dhcp_parser:subscribe() was called.
  subscribe_to_all(self, 'dhcp', mac_address)
end

function dhcp_parser:publish_dhcp(check_if_updated)
  for mac_address, data in pairs(info.io.dhcp) do
    self:publish_one_record(mac_address, check_if_updated)
  end
end

-- Called when MQTT connects and returns a list of topics this module should subscribe to.
function dhcp_parser:subscribe()
  local subscritions = {}
  -- TODO Subscribe to updates from other DHCP servers on the network.
  --   subscribe_to["homeautomation/+/dhcp"] = true

  for dhcp_lease, things in pairs(info.io.dhcp) do
    if type(things) == 'table' then
      subscritions[#subscritions +1] = {role = 'dhcp', address = dhcp_lease}
    end
  end

  return subscritions
end

-- Publishes topics this module knows about. 
function dhcp_parser:announce()
  log("dhcp_parser:announce()")
  self:publish_dhcp()
end

-- This gets called whenever a topic this module is subscribed to appears on the bus.
function dhcp_parser:callback(path, incoming_data)
  log("dhcp_parser:callback", path, incoming_data._command)
  path = var_to_path(path)
  local incoming_command = incoming_data._command
  local role, identifier = path:match('(.-)/(.+)')
  
  if role == '_all' then
    role = 'dhcp'
  end

  if role == 'dhcp' and info.io[role] and incoming_command == 'solicit' then
    if identifier == '_all' then
      for mac_address, _ in pairs(info.io[role]) do
        if is_sanitized_mac_address(mac_address) then
          self:publish_one_record(mac_address, false)
        end
      end
    elseif info.io[role][identifier] then
      self:publish_one_record(identifier, false)
    end
  end
end

return dhcp_parser

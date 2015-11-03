#!/usr/bin/lua

--[[ Parse DHCP log file for devices matching those in the configuration file and
     generate unique user records for anyone with a device connected to the network. ]]--

local DEVICE_CONFIG = '/etc/homeautomation/trigger_dhcp.conf'
local DHCP_FILE = '/tmp/dhcp.leases'

local dhcp_parser = {test = 0}
dhcp_parser.__index = dhcp_parser


function dhcp_parser.new()
  print("dhcp_parser.new()")

  local self = setmetatable({}, dhcp_parser)
  
  if info.io == nil then
    info.io = {}
  end
  if info.io.dhcp == nil then
    info.io.dhcp = {}
  end
  if info.io.users == nil then
    info.io.users = {}
  end
  if info.mqtt == nil then
    info.mqtt = {}
  end
  if info.mqtt.subscription_loaders == nil then
    info.mqtt.subscription_loaders = {}
  end
  if info.mqtt.announcer_loaders == nil then
    info.mqtt.announcer_loaders = {}
  end

  info.mqtt.subscription_loaders['dhcp'] = self.subscribe
  info.mqtt.announcer_loaders['dhcp'] = self.announce

  return self
end

function dhcp_parser.read_dhcp(self)
  local key, value, mac, google_id, display_name, image, update
  
  -- Read dhcp config file to find which devices we care about.
  if not is_file_or_dir(DEVICE_CONFIG) then
    print('Error: ' .. DEVICE_CONFIG .. ' not found.')
    info.io.dhcp.ERROR = 'file ' .. DEVICE_CONFIG .. ' not found.'
    return
  end

  local file_mod_time_string = file_mod_time(DEVICE_CONFIG)
  if file_mod_time_string ~= info.io.dhcp.file_update_time then
    -- Only doing this if the file had been modified.
    print('File ' .. DEVICE_CONFIG .. ' was modified.')
    info.io.dhcp.file_update_time = file_mod_time_string
  
    local file_handle = io.open(DEVICE_CONFIG, "r")
    if not file_handle then
      return
    end

    -- Track if we need to clear cached dhcp entries.
    for mac in next, info.io.dhcp do
      if type(info.io.dhcp[mac]) == 'table' then
        info.io.dhcp[mac].potentially_stale = true
      end
    end

    for line in file_handle:lines() do
      key, value = string.match(line, "^%s*trigger_dhcp\.([%a_]+)%s*:%s*(.+)%s*$")
      if key then
        if key == 'mac' then
          mac = sanitize_mac_address(value)
        elseif key == 'google_id' then
          google_id = sanitize_digits(value)
        elseif key == 'display_name' then
         display_name = sanitize_text(value)
        elseif key == 'image' then
          image = sanitize_url(value)
        else
          print ('Error: unknown key: ' .. key)
        end

        if mac and google_id and display_name and image then
          if info.io.dhcp[mac] == nil then
            info.io.dhcp[mac] = {}
            update = true
          end
          info.io.dhcp[mac].google_id = google_id
          info.io.dhcp[mac].display_name = display_name
          info.io.dhcp[mac].image = image
          info.io.dhcp[mac].potentially_stale = nil

          mac = nil
          google_id = nil
          display_name = nil
          image = nil
        end
      end
    end
    file_handle:close()
  end

  for stored_mac, device in pairs(info.io.dhcp) do
    if info.io.dhcp[stored_mac].potentially_stale then
      info.io.dhcp[stored_mac] = nil
      update = true
      break -- Not safe to continue with for loop. Cleanup will continue on next iteration.
    end
  end

  -- Read dhcp leases file to see what's actually been on the network recently.
  -- We only cache data already in the DB as we don't care about anything that wasn't in the config file.
  file_handle = io.open(DHCP_FILE, "r")
  if file_handle then
    for line in file_handle:lines() do
      local mac, address, name = string.match(line, "^%s*%d+%s+([%x:]+)%s+([%d\.]+)%s+([%w_-%*]+)")
      mac = sanitize_mac_address(mac)
      address = sanitize_network_address(address)
      name = sanitize_text(name)
      
      for stored_mac, device in pairs(info.io.dhcp) do
        if stored_mac == mac then
          info.io.dhcp[stored_mac].address = address
          info.io.dhcp[stored_mac].dhcp_name = name
        end
      end
    end
    file_handle:close()
  end

  -- Check devices are actually reachable on the network.
  for stored_mac, device in pairs(info.io.dhcp) do
    local reachable
    if device.address and os.execute('ping -c1 -W1 ' .. device.address .. ' 1> /dev/null') == 0 then
      -- Is reachable.
      --info.io.dhcp[stored_mac].reachable = true
      reachable = true
    end
    if info.io.dhcp[stored_mac].reachable ~= reachable then
      info.io.dhcp[stored_mac].reachable = reachable
      update = true
    end
  end

  if update then
    print("update")
    self.colapse_user_tree()
    self.publish_users()
  end

  return
end

-- Create unique users by combining dhcp records.
function dhcp_parser:colapse_user_tree()
  -- Clear current entries from the DB so we can re-generate.
  for google_id, _ in  pairs(info.io.users) do
    info.io.users[google_id] = nil
  end

  for mac, device in pairs(info.io.dhcp) do
    if type(device) == 'table' then
      if info.io.users[device.google_id] == nil then
        info.io.users[device.google_id] = {devices = {}}
      end
      info.io.users[device.google_id].display_name = device.display_name
      if device.reachable then
        info.io.users[device.google_id].devices[mac] = {}
        info.io.users[device.google_id].devices[mac].dhcp_name = device.dhcp_name
        info.io.users[device.google_id].devices[mac].address = device.address
      end
    end
  end
end

-- Publish user records on MQTT.
function dhcp_parser:publish_users()
  local topic, payload

  for google_id, user in  pairs(info.io.users) do
    local count_devices = 0
    for _,_ in pairs(user.devices) do
      count_devices = count_devices +1
    end

    topic = "homeautomation/0/users/announce"
    payload = "users/" .. google_id .. " : " .. count_devices
    print(topic, payload)
    mqtt_instance:publish(topic, payload)
  end

end

function dhcp_parser:subscribe(subscribe_to)
  -- TODO Subscribe to updates from other DHCP servers on the network.
  --   subscribe_to["homeautomation/+/dhcp"] = true
  return subscribe_to
end

function dhcp_parser:announce()
end

return dhcp_parser

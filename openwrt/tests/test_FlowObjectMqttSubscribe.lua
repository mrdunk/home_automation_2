#!/usr/bin/lua

--DEBUG = true

package.path = package.path .. ';../fs_root/usr/share/homeautomation/?.lua'
require 'os'
require 'file_utils'
json = require 'json'
require 'helper_functions'

mock_mqtt_class = require 'mock_mqtt_class'
mqtt_instance = mock_mqtt_class.new()

mock_control_class = require 'mock_control_class'
control_instance = mock_control_class.new()

mock_component_class = require 'mock_component_class'

info = {}


function testHelperFunctionsGetPath()
  print('------ testHelperFunctionsGetPath ------')

  assert(get_path(nil, 'sub.path') == nil)

  local test_object = {}
  assert(get_path(test_object, 'sub.path') == nil)

  test_object.sub = {}
  assert(get_path(test_object, 'sub.path') == nil)

  test_object.sub.path = true
  assert(get_path(test_object, 'sub.path') == true)
end

function testHelperFunctionsPopulateObject()
  print('------ testHelperFunctionsPopulateObject ------')

  local test_object = {}
  assert(get_path(test_object, 'sub.path.with.many.elements') == nil)

  populate_object(test_object, 'sub.path.with.many.elements')
  assert(type(get_path(test_object, 'sub.path.with.many.elements')) == 'table')
	assert(type(test_object.sub.path.with.many.elements) == 'table')

	populate_object(test_object, 'sub.path.with.different.things')
	assert(type(get_path(test_object, 'sub.path.with.different.things')) == 'table')
	assert(type(get_path(test_object, 'sub.path.with.many.elements')) == 'table')
end

function testComponentSetup()
  print('------ testComponentSetup ------')
  local control_class = require 'control'
  assert(control_class, 'Unable to load "control.lua".')

  local test_object = component:new{object_type='component', instance_name='instance_name', unique_id='unique_id'}
  assert(test_object.instance_name == 'instance_name', 'Invalid instance_name')
  assert(test_object.unique_id == 'unique_id', 'Invalid unique_id')

  test_object:setup('instance_name', 'unique_id')
  assert(test_object.instance_name == 'instance_name', 'Invalid instance_name')
  assert(test_object.unique_id == 'unique_id', 'Invalid unique_id')

  local test_object_2 = component:new{object_type='component', instance_name='instance_name_2', unique_id='unique_id'}
  assert(test_object_2.instance_name == 'instance_name_2', 'Invalid instance_name')
  assert(test_object_2.unique_id ~= 'unique_id', 'Duplicate unique_id')

  local test_object_3 = component:new{object_type='component', instance_name='instance_name_3', unique_id='unique_id_3'}
  assert(test_object_3.instance_name == 'instance_name_3', 'Invalid instance_name')
  assert(test_object_3.unique_id == 'unique_id_3', 'Invalid unique_id')
end

function testComponentMerge()
  print('------ testComponentMerge ------')
  local control_class = require 'control'
  assert(control_class, 'Unable to load "control.lua".')

  local test_object = component:new{object_type='component', instance_name='instance_name', unique_id='unique_id'}
	assert(test_object.version == 0)
	test_object.version = 5

	-- Should not update because no 'version' in data.
	local return_val = test_object:merge({data={general={instance_name={value='new_name'}}}})
  assert(return_val == nil)
	assert(test_object.version == 5)
	assert(test_object.data.general.instance_name.value == 'instance_name')

  -- Matching version numbers should still update, even though in an ideal world no 2 clients should have the same value.
	return_val = test_object:merge({version=5, data={general={instance_name={value='new_name'}}}})
  assert(return_val)
	assert(test_object.version == 5)
	assert(test_object.data.general.instance_name.value == 'new_name')

  return_val = test_object:merge({version=10, data={general={instance_name={value='new_name_2'}}}})
  assert(return_val)
  assert(test_object.version == 10)
  assert(test_object.data.general.instance_name.value == 'new_name_2')

  -- Make sure invalid characters are removed from name.
  return_val = test_object:merge({version=11, data={general={instance_name={value='new name 3'}}}})
  assert(return_val)
  assert(test_object.version == 11)
  assert(test_object.data.general.instance_name.value == 'new_name_3', 'Expected: new_name_3  got: ' .. test_object.data.general.instance_name.value)

  return_val = test_object:merge({version=12, data={general={instance_name={value='"new" name (4*)'}}}})
  assert(return_val)
  assert(test_object.version == 12)
  assert(test_object.data.general.instance_name.value == 'new_name_4', 'Expected: new_name_4  got: ' .. test_object.data.general.instance_name.value)

  return_val = test_object:merge({version=13, data={general={instance_name={value='""(*)'}}}})
  assert(return_val == nil)
  assert(test_object.version == 13)
  assert(test_object.data.general.instance_name.value == 'new_name_4', 'Expected: new_name_4  got: ' .. test_object.data.general.instance_name.value)
end

function testComponentAddLink()
  print('------ testComponentAddLink ------')
  local control_class = require 'control'
  assert(control_class, 'Unable to load "control.lua".')

  local mock_object_1 = mock_component_class:new{unique_id='mock_object_1'}
  local mock_object_2 = mock_component_class:new{unique_id='mock_object_2'}

  local test_object = component:new{object_type='component', instance_name='instance_name', unique_id='unique_id'}

  test_object:add_link(mock_object_1, 'default_in', 'default_out')
  assert(#test_object.data.outputs.default_out == 1, 'Wrong number of links.')

  test_object:add_link(mock_object_1, 'default_in', 'default_out')
  assert(#test_object.data.outputs.default_out == 1, 'Wrong number of links.')

  test_object:add_link(mock_object_1, 'other_in', 'default_out')
  assert(#test_object.data.outputs.default_out == 2, 'Wrong number of links.')

  test_object:add_link(mock_object_2, 'default_in', 'default_out')
  test_object:add_link(mock_object_2, 'other_in', 'default_out')
  assert(#test_object.data.outputs.default_out == 4, 'Wrong number of links.')

  test_object:delete_link(mock_object_1, 'other_in', 'default_out')
  assert(#test_object.data.outputs.default_out == 3, 'Wrong number of links.')

  test_object:delete_link(mock_object_1, 'other_in', 'default_out')
  assert(#test_object.data.outputs.default_out == 3, 'Wrong number of links.')

  test_object:delete_link(mock_object_1, 'default_in', 'default_out')
  test_object:delete_link(mock_object_2, 'default_in', 'default_out')
  test_object:delete_link(mock_object_2, 'other_in', 'default_out')
  assert(#test_object.data.outputs.default_out == 0, 'Wrong number of links.')
end

function testComponentSendOutput()
  print('------ testComponentSendOutput ------')
  local control_class = require 'control'

  local mock_object_1 = mock_component_class:new{unique_id='mock_object_1'}
  local mock_object_2 = mock_component_class:new{unique_id='mock_object_2'}
  local test_object = component:new{object_type='component', instance_name='instance_name', unique_id='unique_id'}

  -- Only link one of the objects.
  test_object:add_link(mock_object_1, 'default_in', 'default_out')
  test_object:send_output({a='test data'}, 'default_out')
  assert(mock_object_1.last_received.a == 'test data')
  assert(mock_object_2.last_received.a == nil)
  assert(#mock_object_1.last_received.__trace == 1)
  assert(mock_object_2.last_received.__trace == nil)

  -- Link other object.
  test_object:add_link(mock_object_2, 'default_in', 'default_out')
  test_object:send_output({b='test data'}, 'default_out')
  assert(mock_object_1.last_received.b == 'test data')
  assert(mock_object_2.last_received.b == 'test data')
  assert(#mock_object_1.last_received.__trace == 1)
  assert(#mock_object_2.last_received.__trace == 1)

  -- Remove a link.
  test_object:delete_link(mock_object_1, 'default_in', 'default_out')
  test_object:send_output({c='test data'}, 'default_out')
  assert(mock_object_1.last_received.c == nil)
  assert(mock_object_2.last_received.c == 'test data')
end

function testComponentAddTrace()
  print('------ testComponentAddTrace ------')
  local control_class = require 'control'

  local test_object_1 = component:new{object_type='component', instance_name='instance_name_1', unique_id='unique_id_1'}
  local test_object_2 = component:new{object_type='component', instance_name='instance_name_2', unique_id='unique_id_2'}
  local test_data = {a='test data', __trace={}}
  table.insert(test_data.__trace, {source_object='source_unique_id', source_port='source_port'})

  local data_copy_1 = test_object_1:make_data_copy(test_data, "port_label", "from_unique_id", "from_port_label")
  local data_copy_2 = test_object_2:make_data_copy(test_data, "port_label", "from_unique_id", "from_port_label")

  assert(test_data.__trace[1].destination_object == nil)
  assert(data_copy_1.__trace[1].destination_object ~= nil)
  assert(data_copy_1.__trace[1].destination_port ~= nil)
  assert(data_copy_1.__trace[1].destination_object ~= data_copy_2.__trace[1].destination_object)

  -- This should error as it's already had the destination information filled.
  data_copy_1 = test_object_1:make_data_copy(data_copy_1, "port_label", "from_unique_id", "from_port_label")
  assert(data_copy_1.error ~= nil)

  -- This should error as we are feeding the same data back into a port it's already been through.
  table.insert(data_copy_2.__trace, {source_object='unique_id_2', source_port='port_label'})
  local data_copy_2_b = test_object_2:make_data_copy(data_copy_2, "port_label", "from_unique_id", "from_port_label")
  assert(data_copy_2_b.error ~= nil)
end

function testFlowObjectMqttSubscribe()
  print('------ testFlowObjectMqttSubscribe ------')

  local test_object = FlowObjectMqttSubscribe:new{instance_name='instance_name', unique_id='unique_id'}

  assert(info.mqtt.callbacks['instance_name'] == test_object)

  local mock_object_1 = mock_component_class:new{unique_id='mock_object_1'}
  test_object:add_link(mock_object_1, 'default_in', 'default_out')
end

function testFlowObjectMqttSubscribeMerge()
  print('------ testFlowObjectMqttSubscribeMerge ------')

  local test_object = FlowObjectMqttSubscribe:new{instance_name='instance_name', unique_id='unique_id'}

  return_val = test_object:merge({version=12, data={general={instance_name={value='new name'}}}})
  assert(return_val)
  assert(test_object.version == 12)
  assert(test_object.data.general.instance_name.value == 'new_name', 'Expected: new_name  got: ' .. test_object.data.general.instance_name.value)

	local topic = 'test/+/topic/#'
  return_val = test_object:merge({version=13, data={general={instance_name={value='new name'}},inputs={subscription={subscribed_topic={value=topic}}}}})
  assert(return_val)
  assert(test_object.version == 13)
	assert(test_object.data.inputs.subscription.subscribed_topic.value == topic)

	local topic = 'invalid topic'
  return_val = test_object:merge({version=14, data={general={instance_name={value='new name'}},inputs={subscription={subscribed_topic={value=topic}}}}})
  assert(return_val == nil)
  assert(test_object.version == 14)
  assert(test_object.data.inputs.subscription.subscribed_topic.value ~= topic)
end

function testFlowObjectMqttSubscribeSubscribe()
  print('------ testFlowObjectMqttSubscribeSubscribe ------')

  local test_object = FlowObjectMqttSubscribe:new{instance_name='instance_name', unique_id='unique_id'}
	local topic = 'test/topic/#'
  return_val = test_object:merge({version=1, data={inputs={subscription={subscribed_topic={value=topic}}}}})
  assert(return_val)
  assert(test_object.version == 1)
  assert(test_object.data.inputs.subscription.subscribed_topic.value == topic)

	-- Mock functions to be called by test_object:subscribe()
	local unsubscribe_all_track = false
	function unsubscribe_all(unsubscribe_instance_name)
		unsubscribe_all_track = (unsubscribe_instance_name == test_object.instance_name)
  end
	local subscribe_to_all_track = false
	function subscribe_to_all(object, role, address)
		subscribe_to_all_track = (object.instance_name == test_object.instance_name)
	end

	test_object:subscribe()
	assert(unsubscribe_all_track)
	assert(subscribe_to_all_track)
end

function testFlowObjectSwitch()
  print('------ testFlowObjectSwitch ------')

  local test_object = FlowObjectSwitch:new{instance_name='instance_name', unique_id='unique_id'}
end

function main()
  print('Starting.')
  for i,v in pairs(arg) do
    if v == '-d' then
      DEBUG = true
      print('  debugging on.')
    end
  end

  testHelperFunctionsGetPath()
  testHelperFunctionsPopulateObject()

  testComponentSetup()
	testComponentMerge()
  testComponentAddLink()
  testComponentSendOutput()
  testComponentAddTrace()

  testFlowObjectMqttSubscribe()
  testFlowObjectMqttSubscribeMerge()
	testFlowObjectMqttSubscribeSubscribe()

  testFlowObjectSwitch()
end


main()

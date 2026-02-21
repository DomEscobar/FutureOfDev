/**
 * Task Model Mock
 * 
 * This mock resolves "TypeError: require(...) is not a function" error
 * by properly exporting an object with Sequelize model methods.
 * 
 * Common mistake that causes the error:
 *   const Task = require('./Task')()  // WRONG - require returns object, not function
 * 
 * The fix: Export an object with mock methods, not try to invoke require as function
 */

const mockFindAll = jest.fn();
const mockFindOne = jest.fn();
const mockFindByPk = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDestroy = jest.fn();
const mockBulkCreate = jest.fn();
const mockCount = jest.fn();

const Task = {
  findAll: mockFindAll,
  findOne: mockFindOne,
  findByPk: mockFindByPk,
  create: mockCreate,
  update: mockUpdate,
  destroy: mockDestroy,
  bulkCreate: mockBulkCreate,
  count: mockCount,
};

module.exports = { Task };
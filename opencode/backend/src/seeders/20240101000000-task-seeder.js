'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('tasks', [
      {
        title: 'Design homepage mockup',
        description: 'Create wireframes and high-fidelity mockups',
        status: 'todo',
        priority: 'high',
        assignee: 'Alice',
        order: 0,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Set up development environment',
        description: 'Install Node.js, React, and required dependencies',
        status: 'todo',
        priority: 'medium',
        assignee: 'Bob',
        order: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Implement user authentication',
        description: 'Add login and registration endpoints',
        status: 'inprogress',
        priority: 'high',
        assignee: 'Charlie',
        order: 0,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Write unit tests',
        description: 'Cover main service functions with tests',
        status: 'done',
        priority: 'medium',
        assignee: 'Dana',
        order: 0,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'Deploy to production',
        description: 'Configure CI/CD pipeline and deploy to AWS',
        status: 'todo',
        priority: 'high',
        assignee: 'Eve',
        order: 2,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('tasks', null, {});
  }
};

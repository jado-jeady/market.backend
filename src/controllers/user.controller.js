import db from '../models/index.js';

const { User } = db;

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      where: { is_active: true },   // 👈 IMPORTANT
      attributes: { exclude: ['password_hash'] },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// get userName by Id
export const getUserNameById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Using attributes: ['username'] is faster than excluding one field
    const user = await User.findByPk(id, {
      attributes: ['full_name']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user // Returns just the string
    });
  } catch (error) {
    next(error);
  }
};



export const getUserName = async (req, res, next) => {
  User.findAll()
    .then((users) => {
      res.json({
        success: true,
        data: users
      });
    })
    .catch((error) => {
      next(error);
    })
}

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};
//  Get all cashiers
export const getCashiers = async (req, res, next) => {
  try {
    const cashiers = await User.findAll({
      where: { role: 'Cashier' },
      attributes: { exclude: ['password_hash'] },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: cashiers
    });
  } catch (error) {
    next(error);
  }
};


export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent users from changing their own role unless they're admin
    if (req.user.id.toString() === id && updates.role && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'You cannot change your own role'
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove password from updates (use auth endpoint for password changes)
    delete updates.password_hash;

    await user.update(updates);

    // Remove password from response
    const userResponse = {
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    res.json({
      success: true,
      message: 'User updated successfully',
      data: userResponse
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.update({ is_active: false }, { method: 'PATCH' });

    res.json({
      success: true,
      message: 'User disabled successfully'
    });

  } catch (error) {
    next(error);
  }
};


export const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent self-deactivation
    if (req.user.id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.update({ is_active: !user.is_active });

    res.json({
      success: true,
      message: `User ${user.is_active ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: user.id,
        is_active: user.is_active
      }
    });
  } catch (error) {
    next(error);
  }
};
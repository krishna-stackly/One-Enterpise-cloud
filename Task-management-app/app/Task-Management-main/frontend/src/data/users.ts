import { SystemRole, type User } from '@/types'

const DEMO_PASSWORD = 'Password@123'

function u(
  id: string,
  firstName: string,
  lastName: string,
  title: string,
  hue: number,
  systemRole: SystemRole = SystemRole.USER,
): User {
  return {
    id,
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}@stackly.io`,
    title,
    systemRole,
    avatarHue: hue,
    password: DEMO_PASSWORD,
  }
}

function associate(id: string, firstName: string, lastName: string, hue: number): User {
  return {
    id,
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}@stackly.io`,
    title: 'Associate',
    systemRole: SystemRole.USER,
    avatarHue: hue,
    password: '!no-login',
  }
}

export const users: User[] = [
  u('usr_arun', 'Arun', 'Menon', 'Engineering Program Manager', 210, SystemRole.ADMIN),
  u('usr_suresh', 'Suresh', 'Iyer', 'Backend Mentor', 160),
  u('usr_nikhil', 'Nikhil', 'Dharani', 'Backend POC', 250),
  u('usr_anil', 'Anil', 'Kumar', 'Backend POC', 190),
  u('usr_meera', 'Meera', 'Shah', 'Frontend Mentor', 300),
  u('usr_ananya', 'Ananya', 'Das', 'Frontend POC', 12),
  u('usr_dev', 'Dev', 'Malhotra', 'Frontend POC', 175),
  u('usr_ravi', 'Ravi', 'Krishnan', 'QA Mentor', 145),
  u('usr_lakshmi', 'Lakshmi', 'Pillai', 'QA POC', 265),
  u('usr_sanjay', 'Sanjay', 'Mishra', 'QA POC', 15),
  u('usr_karthik', 'Karthik', 'Rajan', 'DevOps Mentor', 185),
  u('usr_ishita', 'Ishita', 'Agarwal', 'DevOps POC', 305),
  u('usr_vivek', 'Vivek', 'Nambiar', 'DevOps POC', 155),
  u('usr_leela', 'Leela', 'Thomas', 'Analytics Mentor', 230),
  u('usr_omar', 'Omar', 'Farooq', 'Payroll Mentor', 110),
  u('usr_fatima', 'Fatima', 'Khan', 'Mobile POC', 285),
  associate('usr_rahul', 'Rahul', 'Sharma', 40),
  associate('usr_priya', 'Priya', 'Nair', 55),
  associate('usr_kiran', 'Kiran', 'Reddy', 80),
]

export const userById = Object.fromEntries(users.map((user) => [user.id, user])) as Record<
  string,
  User
>

export const userByEmail = Object.fromEntries(users.map((user) => [user.email, user])) as Record<
  string,
  User
>

export function registerUser(user: User) {
  users.push(user)
  userById[user.id] = user
  userByEmail[user.email.toLowerCase()] = user
  return user
}

export function updateUserPassword(email: string, password: string) {
  const user = userByEmail[email.toLowerCase()]
  if (!user) return false
  user.password = password
  return true
}

/** Replaces the in-memory users with real backend data (used in live API mode). */
export function setUsers(next: User[]) {
  users.length = 0
  users.push(...next)
  for (const key of Object.keys(userById)) delete userById[key]
  for (const key of Object.keys(userByEmail)) delete userByEmail[key]
  for (const user of next) {
    userById[user.id] = user
    userByEmail[user.email.toLowerCase()] = user
  }
}

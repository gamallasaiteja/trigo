import { Redirect } from 'expo-router';

/** Placeholder route for the centre tab button, which opens the Add Task modal. */
export default function AddTab() {
  return <Redirect href="/task/new" />;
}

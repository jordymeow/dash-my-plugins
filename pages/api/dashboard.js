import { getDashboardData } from '../../libs/dashboard';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const data = await getDashboardData();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch {
    return res.status(503).json({ error: 'WordPress.org could not be reached. Your previous snapshot is still shown; try again shortly.' });
  }
}

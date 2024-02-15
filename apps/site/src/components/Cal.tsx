import Cal, { getCalApi } from '@calcom/embed-react';
import { useEffect } from 'react';

export default function MyApp() {
	useEffect(() => {
		(async () => {
			const cal = await getCalApi();
			cal('ui', {
				hideEventTypeDetails: false,
				layout: 'month_view',
			});
		})();
	}, []);
	return (
		<Cal
			calLink="alexanderniebuhr/catch-up"
			style={{ width: '100%', height: '100%', overflow: 'scroll' }}
			config={{ layout: 'month_view' }}
		/>
	);
}

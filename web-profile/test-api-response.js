// Quick test script to check API response
// Run this in browser console on localhost:3000 while logged in

async function testAPI() {
    const response = await fetch('/api/profile', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
    });

    const data = await response.json();
    console.log('API Response:', data);
    console.log('Experiences:', data.experiences);
    console.log('Educations:', data.educations);
    return data;
}

testAPI();

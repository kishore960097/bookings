-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. CUSTOM TYPES
CREATE TYPE user_role AS ENUM ('consumer', 'owner', 'admin');
CREATE TYPE business_status AS ENUM ('draft', 'under_review', 'approved', 'live', 'rejected', 'suspended', 'closed');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'pay_at_shop');
CREATE TYPE queue_status AS ENUM ('waiting', 'calling', 'in_chair', 'served', 'skipped', 'no_show', 'cancelled');
CREATE TYPE slot_status AS ENUM ('active', 'disabled', 'blocked');

-- 3. TABLES

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'consumer',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Salons (Acts as both Turf businesses and Salons)
CREATE TABLE salons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    cover_url TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    phone TEXT NOT NULL,
    status business_status NOT NULL DEFAULT 'draft',
    booking_mode TEXT NOT NULL DEFAULT 'appointment',
    facilities JSONB, -- Array of strings for turfs
    photos JSONB, -- Array of image URLs
    booking_settings JSONB DEFAULT '{}'::jsonb, -- advanceBookingDays, minNoticeMinutes, cancellationAllowed, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Salon/Turf Business Hours
CREATE TABLE salon_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    day_name TEXT NOT NULL,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(salon_id, day_of_week)
);

-- Services / Pricing rules
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    category TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Staff / Turf Resources
CREATE TABLE staff_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Optional, if staff is a registered user
    name TEXT NOT NULL,
    title TEXT,
    photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'available',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    resource_type TEXT NOT NULL DEFAULT 'staff', -- 'staff' or 'turf'
    capacity INTEGER, -- For turfs
    price_per_hour DECIMAL(10,2), -- For turfs
    service_ids JSONB, -- Array of UUIDs this staff can perform
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings (Appointments & Turf Slots)
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES staff_resources(id) ON DELETE SET NULL, -- Maps to resourceId/staffId
    scheduled_date DATE,
    scheduled_time TIME,
    slot_end_time TIME,
    amount DECIMAL(10, 2) NOT NULL,
    status booking_status NOT NULL DEFAULT 'pending',
    payment_status payment_status NOT NULL DEFAULT 'pending',
    mode TEXT NOT NULL DEFAULT 'appointment', -- 'appointment', 'token', 'resource_slot'
    number_of_players INTEGER,
    token_number TEXT,
    queue_position INTEGER,
    estimated_wait_minutes INTEGER,
    notes TEXT,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    refund_percentage DECIMAL(5, 2),
    refund_amount DECIMAL(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- MANDATORY: DOUBLE BOOKING PROTECTION (ATOMIC)
    -- Ensure no two non-cancelled bookings exist for the same staff/resource on the same date/time
    -- This constraint is a basic form. For a more robust overlap check, you'd use range types and EXCLUDE constraints.
    -- However, standard simple constraint on exact start_time is provided here.
    CONSTRAINT prevent_double_booking EXCLUDE USING gist (
        salon_id WITH =,
        staff_id WITH =,
        scheduled_date WITH =,
        tsrange(
            (scheduled_date + scheduled_time)::timestamp,
            (scheduled_date + COALESCE(slot_end_time, scheduled_time + interval '30 minutes'))::timestamp,
            '[)'
        ) WITH &&
    ) WHERE (status NOT IN ('cancelled', 'no_show'))
);

-- Live Queue Entries
CREATE TABLE queue_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff_resources(id) ON DELETE SET NULL,
    token_number TEXT NOT NULL,
    position INTEGER NOT NULL,
    status queue_status NOT NULL DEFAULT 'waiting',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff_resources(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    owner_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Custom/Blocked Slots (Turfs)
CREATE TABLE custom_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES staff_resources(id) ON DELETE CASCADE,
    slot_date DATE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER,
    price DECIMAL(10,2),
    label TEXT,
    status slot_status NOT NULL DEFAULT 'active',
    is_recurring BOOLEAN DEFAULT FALSE,
    days_of_week JSONB, -- [1,2,3,4,5]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_slots ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile, Owners can read customer profiles they have bookings with (handled securely via backend or complex joins, for simplicity we allow users to read their own and admins to read all)
-- For public display (like staff/owner names), we might need a public view, but for now:
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
-- Allow reading profiles if they are owners of salons you interact with or if you are the owner and they are your customer.
-- For simplicity in this migration, we will keep profiles fully readable by authenticated users so they can see names.
CREATE POLICY "Authenticated users can view profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');

-- Salons: Anyone can read approved/live salons. Owners can read/write their own.
CREATE POLICY "Anyone can view live salons" ON salons FOR SELECT USING (status IN ('live', 'approved'));
CREATE POLICY "Owners can view own salons" ON salons FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Owners can insert own salons" ON salons FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update own salons" ON salons FOR UPDATE USING (owner_id = auth.uid());

-- Salon Hours: Anyone can read. Owners can manage.
CREATE POLICY "Anyone can view salon hours" ON salon_hours FOR SELECT USING (true);
CREATE POLICY "Owners can manage salon hours" ON salon_hours FOR ALL USING (
    EXISTS (SELECT 1 FROM salons WHERE salons.id = salon_hours.salon_id AND salons.owner_id = auth.uid())
);

-- Services: Anyone can read. Owners can manage.
CREATE POLICY "Anyone can view services" ON services FOR SELECT USING (true);
CREATE POLICY "Owners can manage services" ON services FOR ALL USING (
    EXISTS (SELECT 1 FROM salons WHERE salons.id = services.salon_id AND salons.owner_id = auth.uid())
);

-- Staff/Resources: Anyone can read. Owners can manage.
CREATE POLICY "Anyone can view staff/resources" ON staff_resources FOR SELECT USING (true);
CREATE POLICY "Owners can manage staff/resources" ON staff_resources FOR ALL USING (
    EXISTS (SELECT 1 FROM salons WHERE salons.id = staff_resources.salon_id AND salons.owner_id = auth.uid())
);

-- Bookings: Customers can read/create their own. Owners can read/update bookings for their salons.
CREATE POLICY "Customers can view own bookings" ON bookings FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Owners can view salon bookings" ON bookings FOR SELECT USING (
    EXISTS (SELECT 1 FROM salons WHERE salons.id = bookings.salon_id AND salons.owner_id = auth.uid())
);
CREATE POLICY "Customers can insert bookings" ON bookings FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Customers can update own bookings" ON bookings FOR UPDATE USING (customer_id = auth.uid());
CREATE POLICY "Owners can update salon bookings" ON bookings FOR UPDATE USING (
    EXISTS (SELECT 1 FROM salons WHERE salons.id = bookings.salon_id AND salons.owner_id = auth.uid())
);

-- Queue Entries: Publicly readable for live queue display. Managed by backend/owner.
CREATE POLICY "Anyone can view queue entries" ON queue_entries FOR SELECT USING (true);
CREATE POLICY "Owners can manage queue entries" ON queue_entries FOR ALL USING (
    EXISTS (SELECT 1 FROM salons WHERE salons.id = queue_entries.salon_id AND salons.owner_id = auth.uid())
);

-- Reviews: Anyone can read. Customers can create. Owners can respond.
CREATE POLICY "Anyone can view reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Customers can create reviews" ON reviews FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Owners can update reviews (responses)" ON reviews FOR UPDATE USING (
    EXISTS (SELECT 1 FROM salons WHERE salons.id = reviews.salon_id AND salons.owner_id = auth.uid())
);

-- Notifications: Users can manage their own.
CREATE POLICY "Users can manage own notifications" ON notifications FOR ALL USING (user_id = auth.uid());

-- Custom Slots: Publicly readable. Owners manage.
CREATE POLICY "Anyone can view custom slots" ON custom_slots FOR SELECT USING (true);
CREATE POLICY "Owners can manage custom slots" ON custom_slots FOR ALL USING (
    EXISTS (SELECT 1 FROM salons WHERE salons.id = custom_slots.salon_id AND salons.owner_id = auth.uid())
);

-- 5. STORAGE POLICIES
-- NOTE: The 'turf-images' bucket must be created manually in Supabase.
-- Assuming bucket 'turf-images' exists:
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'turf-images' );
-- CREATE POLICY "Owner Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'turf-images' AND auth.role() = 'authenticated' );
-- CREATE POLICY "Owner Update" ON storage.objects FOR UPDATE USING ( bucket_id = 'turf-images' AND auth.role() = 'authenticated' );
-- CREATE POLICY "Owner Delete" ON storage.objects FOR DELETE USING ( bucket_id = 'turf-images' AND auth.role() = 'authenticated' );

-- 6. TRIGGERS
-- Automatically update updated_at columns
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_salons_modtime BEFORE UPDATE ON salons FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_salon_hours_modtime BEFORE UPDATE ON salon_hours FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_services_modtime BEFORE UPDATE ON services FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_staff_resources_modtime BEFORE UPDATE ON staff_resources FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_bookings_modtime BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_queue_entries_modtime BEFORE UPDATE ON queue_entries FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_reviews_modtime BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_custom_slots_modtime BEFORE UPDATE ON custom_slots FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.email,
    new.raw_user_meta_data->>'phone',
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'consumer'::public.user_role)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================
-- Count 컬럼 자동 동기화 트리거
-- ============================================

-- ============================================
-- 1. Post like_count 트리거
-- ============================================

-- 좋아요 추가/삭제 시 like_count 업데이트
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET like_count = like_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET like_count = like_count - 1
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_post_like_count ON public.post_likes;
CREATE TRIGGER trigger_post_like_count
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_like_count();

-- ============================================
-- 2. Post comment_count 트리거
-- ============================================

-- 댓글 추가/삭제 시 comment_count 업데이트
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET comment_count = comment_count - 1
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_post_comment_count ON public.comments;
CREATE TRIGGER trigger_post_comment_count
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();

-- ============================================
-- 3. Category post_count 트리거
-- ============================================

-- 게시글 생성/삭제/카테고리 변경 시 post_count 업데이트
CREATE OR REPLACE FUNCTION update_category_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.category_id IS NOT NULL THEN
      UPDATE public.categories
      SET post_count = post_count + 1
      WHERE id = NEW.category_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.category_id IS NOT NULL THEN
      UPDATE public.categories
      SET post_count = post_count - 1
      WHERE id = OLD.category_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- 카테고리가 변경된 경우
    IF OLD.category_id IS DISTINCT FROM NEW.category_id THEN
      IF OLD.category_id IS NOT NULL THEN
        UPDATE public.categories
        SET post_count = post_count - 1
        WHERE id = OLD.category_id;
      END IF;
      IF NEW.category_id IS NOT NULL THEN
        UPDATE public.categories
        SET post_count = post_count + 1
        WHERE id = NEW.category_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_category_post_count ON public.posts;
CREATE TRIGGER trigger_category_post_count
AFTER INSERT OR DELETE OR UPDATE OF category_id ON public.posts
FOR EACH ROW EXECUTE FUNCTION update_category_post_count();

-- ============================================
-- 4. Tag post_count 트리거 (M:N 관계)
-- ============================================

-- _PostToTag 조인 테이블 변경 시 post_count 업데이트
CREATE OR REPLACE FUNCTION update_tag_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tags
    SET post_count = post_count + 1
    WHERE id = NEW."B";
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tags
    SET post_count = post_count - 1
    WHERE id = OLD."B";
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tag_post_count ON public."_PostToTag";
CREATE TRIGGER trigger_tag_post_count
AFTER INSERT OR DELETE ON public."_PostToTag"
FOR EACH ROW EXECUTE FUNCTION update_tag_post_count();

-- ============================================
-- 5. 초기 데이터 동기화 (기존 데이터가 있는 경우)
-- ============================================

-- Post like_count 동기화
UPDATE public.posts p
SET like_count = (
  SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id
);

-- Post comment_count 동기화
UPDATE public.posts p
SET comment_count = (
  SELECT COUNT(*) FROM public.comments c WHERE c.post_id = p.id
);

-- Category post_count 동기화
UPDATE public.categories c
SET post_count = (
  SELECT COUNT(*) FROM public.posts p WHERE p.category_id = c.id
);

-- Tag post_count 동기화
UPDATE public.tags t
SET post_count = (
  SELECT COUNT(*) FROM public."_PostToTag" pt WHERE pt."B" = t.id
);
